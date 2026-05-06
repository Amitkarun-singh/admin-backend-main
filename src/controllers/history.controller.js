import { Op } from "sequelize";
import sequelize from "../config/db.js";

import GiniLog          from "../models/gini_log.model.js";
import TutorLog         from "../models/Tutor_log.model.js";
import PracticeLog      from "../models/practice_log.model.js";
import AiUsageLog       from "../models/ai_usage_log.model.js";
import UserSession      from "../models/user_session.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import StudentProfile   from "../models/student_profile.model.js";

import { ApiError }     from "../utils/ApiError.js";
import { ApiResponse }  from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ─────────────────────────────────────────────────────────────
   TUTOR USER MATCH
   Matches on both the direct user_id column AND JSON-extracted
   user_details.user_id to handle any schema inconsistencies.
───────────────────────────────────────────────────────────── */
const TUTOR_UID        = `CAST(JSON_UNQUOTE(JSON_EXTRACT(user_details, '$.user_id')) AS UNSIGNED)`;
const TUTOR_USER_MATCH = `(user_id = :uid OR ${TUTOR_UID} = :uid)`;

/* ─────────────────────────────────────────────────────────────
   TUTOR_LOGS SCHEMA (as of 2026-05-06)
   ─────────────────────────────────────────────────────────────
   Each row = ONE TURN (one user message + one AI reply).
   session_id groups all turns of one conversation.

   request_body formats:
     NEW → {"role":"user","content":"how are you"}
     OLD → {"message":"[{\"role\":\"user\",\"content\":\"...\"},...]","sessionId":"..."}

   response_body formats:
     A → {"message":{"type":"final","role":"assistant","content":"..."}}
     B → {"message":"plain string reply"}
     C → {"type":"final","role":"assistant","content":"..."}

   To reconstruct a conversation:
     Fetch ALL rows for session_id ORDER BY created_at ASC, id ASC.
     For each row emit: user msg (request_body) + assistant reply (response_body).
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   HELPER: parse device
───────────────────────────────────────────────────────────── */
function parseDevice(ua = "") {
  if (!ua) return "Desktop";
  const s = ua.toLowerCase();
  if (s.includes("tablet") || s.includes("ipad"))                             return "Tablet";
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone")) return "Mobile";
  return "Desktop";
}

/* ─────────────────────────────────────────────────────────────
   HELPER: is this content a voice placeholder?
───────────────────────────────────────────────────────────── */
function isVoiceMessage(content) {
  if (!content || typeof content !== "string") return true;
  const t = content.trim().toLowerCase();
  return t.startsWith("[voice") || t === "";
}

/* ─────────────────────────────────────────────────────────────
   HELPER: extract user message text from a tutor_logs request_body.
   Handles both the NEW single-object format and the OLD cumulative-array format.
───────────────────────────────────────────────────────────── */
function parseTutorUserContent(rawRequestBody) {
  try {
    const rb = typeof rawRequestBody === "string"
      ? JSON.parse(rawRequestBody)
      : rawRequestBody;

    if (!rb) return null;

    // ── NEW FORMAT: {"role":"user","content":"..."} ──
    if (rb.role === "user" && rb.content !== undefined) {
      return String(rb.content).trim() || null;
    }

    // ── OLD FORMAT: {"message":"[{role,content},...]","sessionId":"..."} ──
    if (rb.message && typeof rb.message === "string") {
      try {
        const msgs = JSON.parse(rb.message);
        if (Array.isArray(msgs)) {
          const firstUser = msgs.find(m => m?.role === "user");
          return firstUser?.content ? String(firstUser.content).trim() : null;
        }
      } catch { /* not a JSON array */ }
    }
  } catch { /* ignore */ }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: extract assistant reply text from a tutor_logs response_body.
   Handles all known formats A / B / C.
───────────────────────────────────────────────────────────── */
function parseTutorAssistantContent(rawResponseBody) {
  try {
    const rb = typeof rawResponseBody === "string"
      ? JSON.parse(rawResponseBody)
      : rawResponseBody;

    if (!rb) return null;

    // Format A: {"message":{"type":"final","role":"assistant","content":"..."}}
    if (rb.message && typeof rb.message === "object" && rb.message.content) {
      return String(rb.message.content).trim() || null;
    }

    // Format B: {"message":"plain string reply"}
    if (rb.message && typeof rb.message === "string" && rb.message.trim()) {
      return rb.message.trim();
    }

    // Format C: {"type":"final","role":"assistant","content":"..."}
    if (rb.type === "final" && rb.content) {
      return String(rb.content).trim() || null;
    }

    // Generic fallbacks
    const flat = rb.response ?? rb.answer ?? rb.content ?? rb.text ?? rb.reply;
    if (flat && typeof flat === "string") return flat.trim() || null;

  } catch { /* ignore */ }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: build a full [{role,content}] messages array from
   all rows of a session (pass rows ordered by created_at ASC).
   Each row contributes one user turn + one assistant turn.
───────────────────────────────────────────────────────────── */
function buildTutorMessages(rows) {
  const messages = [];
  for (const row of rows) {
    const userContent = parseTutorUserContent(row.request_body);
    if (userContent !== null) {
      messages.push({ role: "user", content: userContent });
    }
    const assistantContent = parseTutorAssistantContent(row.response_body);
    if (assistantContent !== null) {
      messages.push({ role: "assistant", content: assistantContent });
    }
  }
  return messages;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: get best title from a set of session rows (ASC order).
   Returns first real non-voice user message.
   Falls back to first voice message if no real text found.
───────────────────────────────────────────────────────────── */
function extractTutorTitleFromRows(rows) {
  let voiceFallback = null;
  for (const row of rows) {
    const content = parseTutorUserContent(row.request_body);
    if (!content) continue;
    if (!isVoiceMessage(content)) return content.slice(0, 100);   // best case
    if (!voiceFallback) voiceFallback = content.slice(0, 100);
  }
  return voiceFallback || null;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: extract title from gini/practice request (unchanged)
───────────────────────────────────────────────────────────── */
function extractTitle(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj) return null;

    if (obj.role === "user" && obj.content) {
      const c = obj.content;
      if (typeof c === "string" && c.trim()) return c.trim().slice(0, 100);
    }

    const arr = Array.isArray(obj) ? obj : Array.isArray(obj.messages) ? obj.messages : null;
    if (arr) {
      const firstUser = arr.find(m => m?.role === "user");
      if (firstUser?.content && typeof firstUser.content === "string")
        return firstUser.content.trim().slice(0, 100);
    }

    const flat = obj.question ?? obj.prompt ?? obj.topic ?? obj.query ?? obj.input ?? obj.text;
    if (flat && typeof flat === "string" && flat.trim()) return flat.trim().slice(0, 100);

    return null;
  } catch { return null; }
}

/* ─────────────────────────────────────────────────────────────
   HELPER: relative time
───────────────────────────────────────────────────────────── */
function relativeTime(date) {
  const diffMs  = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);

  if (diffMin < 60)  return `${diffMin} min ago`;
  if (diffH   < 24)  return `${diffH} hour${diffH > 1 ? "s" : ""} ago`;
  if (diffD   === 1) return "Yesterday";
  return `${diffD} days ago`;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: safely read created_at from a Sequelize instance
───────────────────────────────────────────────────────────── */
function getCreatedAt(instance) {
  if (!instance) return null;
  return instance.created_at ?? instance.createdAt ?? null;
}

/* =====================================================
   1. RECORD SESSION ON LOGIN
   ===================================================== */
export const recordSession = async ({ user_id, ua, ip }) => {
  try {
    await UserSession.create({
      user_id,
      login_at:   new Date(),
      device:     parseDevice(ua),
      ip_address: ip || null,
    });
  } catch (err) {
    console.error("recordSession failed:", err.message);
  }
};

/* =====================================================
   2. CLOSE SESSION ON LOGOUT
   ===================================================== */
export const closeSession = async (user_id) => {
  try {
    const session = await UserSession.findOne({
      where: { user_id, logout_at: null },
      order: [["login_at", "DESC"]],
    });
    if (session) {
      session.logout_at = new Date();
      await session.save();
    }
  } catch (err) {
    console.error("closeSession failed:", err.message);
  }
};

/* =====================================================
   3. GET RECENT QUERIES  (AI Gini + AI Tutor)
      GET /api/history/recent-queries

      GINI  → unchanged, groups by conversation_id
      TUTOR → NEW SCHEMA: one row = one turn
              group by session_id → one card per conversation
              turn_count = COUNT(rows) in session
              title      = first non-voice user message (rows ASC)
   ===================================================== */
export const getRecentQueries = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
  const limit   = parseInt(req.query.limit) || 20;

  console.log(`\n========== [getRecentQueries] START ==========`);
  console.log(`[getRecentQueries] user_id: ${user_id}, limit: ${limit}`);

  /* ── AI Gini ── (unchanged) ── */
  const giniConvs = await GiniLog.findAll({
    where: { user_id },
    attributes: [
      "conversation_id",
      [sequelize.fn("MAX", sequelize.col("created_at")), "last_active"],
      [sequelize.fn("COUNT", sequelize.col("id")),       "turn_count"],
    ],
    group: ["conversation_id"],
    order: [[sequelize.fn("MAX", sequelize.col("created_at")), "DESC"]],
    limit,
    raw: true,
  });

  console.log(`[GINI] Total conversations: ${giniConvs.length}`);

  const giniQueries = await Promise.all(
    giniConvs.map(async conv => {
      const rows = await sequelize.query(
        `SELECT messages, subject, \`class\`
         FROM   chatbot_logs
         WHERE  conversation_id = :cid AND user_id = :uid
         ORDER  BY created_at ASC LIMIT 5`,
        {
          replacements: { cid: conv.conversation_id, uid: user_id },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      let title = null, subject = null, cls = null;
      for (const row of rows) {
        subject = subject || row.subject;
        cls     = cls     || row.class;
        if (!title && row.messages) {
          try {
            const msg = JSON.parse(row.messages);
            if (msg?.role === "user" && msg?.content)
              title = String(msg.content).slice(0, 100);
          } catch { /* skip */ }
        }
        if (title) break;
      }

      return {
        source:          "AI Gini",
        redirect_to:     "/ai-gini",
        conversation_id: conv.conversation_id,
        title:           title || subject || "AI Gini conversation",
        subject:         subject || null,
        class:           cls    || null,
        turn_count:      parseInt(conv.turn_count),
        time:            relativeTime(conv.last_active),
        created_at:      conv.last_active,
      };
    })
  );

  /* ── AI Tutor ── NEW SCHEMA ──
     One row per turn. Group by session_id.
     Fetch the first 10 rows ASC per session just for title extraction.
     turn_count = total rows in session (each row = one user turn).
  ── */
  let tutorQueries = [];
  try {
    const tutorSessions = await sequelize.query(
      `SELECT
         session_id,
         MAX(created_at) AS last_active,
         COUNT(id)       AS turn_count
       FROM   tutor_logs
       WHERE  ${TUTOR_USER_MATCH}
         AND  session_id IS NOT NULL
         AND  session_id != ''
       GROUP  BY session_id
       ORDER  BY MAX(created_at) DESC
       LIMIT  :lim`,
      {
        replacements: { uid: user_id, lim: limit },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`[TUTOR] Total unique sessions: ${tutorSessions.length}`);
    console.log(`[TUTOR] Sessions:`, JSON.stringify(tutorSessions, null, 2));

    tutorQueries = (
      await Promise.all(
        tutorSessions.map(async session => {
          console.log(`\n[TUTOR] Processing session_id: ${session.session_id}`);

          // Fetch first 10 rows ASC — enough to find a real text message for the title
          const titleRows = await sequelize.query(
            `SELECT request_body
             FROM   tutor_logs
             WHERE  session_id = :sid AND ${TUTOR_USER_MATCH}
             ORDER  BY created_at ASC, id ASC
             LIMIT  10`,
            {
              replacements: { sid: session.session_id, uid: user_id },
              type: sequelize.QueryTypes.SELECT,
            }
          );

          if (!titleRows.length) {
            console.warn(`[TUTOR] No rows for session ${session.session_id} — skipping`);
            return null;
          }

          const title     = extractTutorTitleFromRows(titleRows) || "AI Tutor conversation";
          const turnCount = parseInt(session.turn_count) || 0;

          console.log(`[TUTOR] session_id:  ${session.session_id}`);
          console.log(`[TUTOR] title:       "${title}"`);
          console.log(`[TUTOR] turn_count:  ${turnCount}`);

          return {
            source:          "AI Tutor",
            redirect_to:     "/ai-tutor",
            conversation_id: session.session_id,   // session_id IS the conversation key
            title,
            turn_count:      turnCount,
            time:            relativeTime(session.last_active),
            created_at:      session.last_active,
          };
        })
      )
    ).filter(Boolean);

  } catch (err) {
    console.error(`[TUTOR] FETCH FAILED:`, err.message);
  }

  const combined = [...giniQueries, ...tutorQueries]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map(({ created_at, ...rest }) => rest);

  console.log(`\n[getRecentQueries] Final combined (${combined.length} items):`);
  console.log(JSON.stringify(combined, null, 2));
  console.log(`========== [getRecentQueries] END ==========\n`);

  return res.status(200).json(
    new ApiResponse(200, combined, "Recent queries fetched")
  );
});

/* =====================================================
   4. GET FEATURES EXPLORED
      GET /api/history/features-explored
   ===================================================== */
export const getFeaturesExplored = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  /* ── Gini ── */
  const giniCount = await GiniLog.count({ where: { user_id } });
  const giniLast  = await GiniLog.findOne({
    where: { user_id }, order: [["created_at", "DESC"]], attributes: ["created_at"],
  });

  /* ── AI Tutor — count unique sessions ── */
  let tutorCount = 0, tutorLastDate = null;
  try {
    const [countRow] = await sequelize.query(
      `SELECT COUNT(DISTINCT session_id) AS cnt
       FROM   tutor_logs
       WHERE  ${TUTOR_USER_MATCH}
         AND  session_id IS NOT NULL
         AND  session_id != ''`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    tutorCount = parseInt(countRow?.cnt) || 0;

    const [lastRow] = await sequelize.query(
      `SELECT created_at
       FROM   tutor_logs
       WHERE  ${TUTOR_USER_MATCH}
       ORDER  BY created_at DESC
       LIMIT  1`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    tutorLastDate = lastRow?.created_at || null;
  } catch (err) {
    console.error(`[getFeaturesExplored] tutor failed:`, err.message);
  }

  /* ── AI Practice ── */
  const practiceCount = await PracticeLog.count({ where: { user_id } });
  const practiceLast  = await PracticeLog.findOne({
    where: { user_id }, order: [["created_at", "DESC"]],
  });

  /* ── AI Notes ── */
  const aiNotesWhere = {
    user_id, feature: "ai_notes",
    [Op.or]: [{ endpoint: { [Op.notLike]: "/api/ainote/%" } }, { endpoint: null }],
  };
  const aiNotesCount = await AiUsageLog.count({ where: aiNotesWhere });
  const aiNotesLast  = await AiUsageLog.findOne({ where: aiNotesWhere, order: [["created_at", "DESC"]] });

  /* ── Doc Summariser ── */
  const summaryCount = await AiUsageLog.count({ where: { user_id, feature: "summarizer" } });
  const summaryLast  = await AiUsageLog.findOne({
    where: { user_id, feature: "summarizer" }, order: [["created_at", "DESC"]],
  });

  const features = [
    { feature: "AI Gini",        uses: giniCount,     last_used: getCreatedAt(giniLast)    ? relativeTime(getCreatedAt(giniLast))    : "Never" },
    { feature: "AI Tutor",       uses: tutorCount,    last_used: tutorLastDate              ? relativeTime(tutorLastDate)             : "Never" },
    { feature: "AI Notes",       uses: aiNotesCount,  last_used: getCreatedAt(aiNotesLast) ? relativeTime(getCreatedAt(aiNotesLast)) : "Never" },
    { feature: "AI Practice",    uses: practiceCount, last_used: getCreatedAt(practiceLast)? relativeTime(getCreatedAt(practiceLast)): "Never" },
    { feature: "Doc Summariser", uses: summaryCount,  last_used: getCreatedAt(summaryLast) ? relativeTime(getCreatedAt(summaryLast)) : "Never" },
  ];

  return res.status(200).json(
    new ApiResponse(200, features, "Features explored fetched")
  );
});

/* =====================================================
   5. GET LOGIN HISTORY
      GET /api/history/login-history
      (unchanged)
   ===================================================== */
export const getLoginHistory = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
  const limit   = parseInt(req.query.limit) || 10;

  const sessions = await UserSession.findAll({
    where: { user_id }, order: [["login_at", "DESC"]], limit,
    attributes: ["session_id", "login_at", "logout_at", "device", "ip_address", "city", "country"],
  });

  const history = sessions.map(s => ({
    session_id: s.session_id,
    date:       new Date(s.login_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" }),
    time:       new Date(s.login_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
    device:     s.device || "Desktop",
    location:   s.city && s.country ? `${s.city}, ${s.country}` : s.ip_address || "Unknown",
    logout_at:  s.logout_at,
  }));

  return res.status(200).json(new ApiResponse(200, history, "Login history fetched"));
});

/* =====================================================
   6. GET WEEK ACTIVITY
      GET /api/history/week-activity
      (unchanged)
   ===================================================== */
export const getWeekActivity = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  const now       = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const sessions = await UserSession.findAll({
    where: { user_id, login_at: { [Op.between]: [weekStart, weekEnd] } },
    attributes: ["login_at"],
    raw: true,
  });

  const activeDays = new Set(sessions.map(s => new Date(s.login_at).getDay()));
  const days = ["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => ({
    label, active: activeDays.has(idx),
  }));

  return res.status(200).json(
    new ApiResponse(200, { days, total_active: activeDays.size }, "Week activity fetched")
  );
});

/* =====================================================
   7. GET STATS
      GET /api/history/stats
      (unchanged)
   ===================================================== */
export const getStats = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  const loginResult = await sequelize.query(
    `SELECT COUNT(DISTINCT DATE(login_at)) AS cnt FROM user_sessions WHERE user_id = :user_id`,
    { replacements: { user_id }, type: sequelize.QueryTypes.SELECT }
  );
  const loginDays = parseInt(loginResult[0]?.cnt) || 0;

  let testOverall = 0;
  try {
    const student = await StudentProfile.findOne({ where: { user_id } });
    if (student) {
      const analytics = await StudentAnalytics.findOne({ where: { student_id: student.student_id } });
      testOverall = analytics?.ai_practice_score ? parseFloat(analytics.ai_practice_score) : 0;
    }
  } catch { /* non-student */ }

  return res.status(200).json(
    new ApiResponse(200, { login_days: loginDays, test_overall: testOverall }, "Stats fetched")
  );
});

/* =====================================================
   8. GET FULL CONVERSATION
      GET /api/history/conversation/:conversation_id
         ?source=gini
         ?source=tutor    ← conversation_id param is session_id
         ?source=practice

   TUTOR — NEW SCHEMA:
     Each row = one turn (user msg + assistant reply).
     Fetch ALL rows for session_id ORDER BY created_at ASC, id ASC.
     For each row: push user message then assistant reply into messages[].
   ===================================================== */
export const getConversation = asyncHandler(async (req, res) => {
  const user_id             = Number(req.user.user_id);
  const { conversation_id } = req.params;   // for tutor this is session_id
  const source              = (req.query.source || "gini").toLowerCase();

  console.log(`\n========== [getConversation] START ==========`);
  console.log(`[getConversation] user_id: ${user_id}, id: ${conversation_id}, source: ${source}`);

  if (!conversation_id) throw new ApiError(400, "conversation_id required");

  /* ── AI Gini ── (unchanged) ── */
  if (source === "gini") {
    const allRows = await sequelize.query(
      `SELECT messages, response_body, subject, \`class\`, language, created_at
       FROM   chatbot_logs
       WHERE  conversation_id = :cid AND user_id = :uid
       ORDER  BY created_at ASC`,
      {
        replacements: { cid: conversation_id, uid: user_id },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!allRows.length) throw new ApiError(404, "Conversation not found");

    const messages = [];
    for (const row of allRows) {
      try {
        const userMsg = JSON.parse(row.messages || "{}");
        if (userMsg?.content !== undefined)
          messages.push({ role: "user", content: userMsg.content });
      } catch { /* skip */ }

      if (row.response_body) {
        try {
          const rb = JSON.parse(row.response_body);
          const oaiContent = rb?.choices?.[0]?.message?.content;
          if (oaiContent) { messages.push({ role: "assistant", content: oaiContent }); continue; }
          const flat = rb?.response ?? rb?.answer ?? rb?.content ?? rb?.text ?? rb?.reply ?? rb?.message;
          if (flat && typeof flat === "string") { messages.push({ role: "assistant", content: flat }); continue; }
          if (typeof rb === "string" && rb.trim()) messages.push({ role: "assistant", content: rb });
        } catch {
          const plain = String(row.response_body).trim();
          if (plain) messages.push({ role: "assistant", content: plain });
        }
      }
    }

    const firstRow  = allRows[0];
    const lastRow   = allRows[allRows.length - 1];
    const firstUser = messages.find(m => m.role === "user");
    const title     = firstUser?.content?.slice(0, 100) || firstRow?.subject || "AI Gini conversation";

    return res.status(200).json(new ApiResponse(200, {
      conversation_id,
      source:      "AI Gini",
      redirect_to: "/ai-gini",
      title,
      subject:    firstRow.subject  || null,
      class:      firstRow.class    || null,
      language:   firstRow.language || null,
      messages,
      turn_count: messages.filter(m => m.role === "user").length,
      started_at: firstRow.created_at,
      updated_at: lastRow.created_at,
    }, "Conversation fetched"));
  }

  /* ── AI Tutor ── NEW SCHEMA ──
     conversation_id param = session_id.
     Fetch ALL rows for this session ordered ASC.
     Each row = one turn → push user msg then assistant reply.
  ── */
  if (source === "tutor") {
    const allRows = await sequelize.query(
      `SELECT id, request_body, response_body, created_at
       FROM   tutor_logs
       WHERE  session_id = :sid AND ${TUTOR_USER_MATCH}
       ORDER  BY created_at ASC, id ASC`,
      {
        replacements: { sid: conversation_id, uid: user_id },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`[TUTOR CONV] session_id: ${conversation_id}, rows: ${allRows.length}`);

    if (!allRows.length) throw new ApiError(404, "Conversation not found");

    // Build the full interleaved message list from all rows
    const messages = buildTutorMessages(allRows);

    // Title: first non-voice user message, fallback to voice
    const title = extractTutorTitleFromRows(allRows) || "AI Tutor conversation";

    const responseData = {
      conversation_id,          // this is the session_id
      source:      "AI Tutor",
      redirect_to: "/ai-tutor",
      title,
      messages,
      turn_count:  messages.filter(m => m.role === "user").length,
      started_at:  allRows[0].created_at,
      updated_at:  allRows[allRows.length - 1].created_at,
    };

    console.log(`[TUTOR CONV] title:       "${title}"`);
    console.log(`[TUTOR CONV] messages:    ${messages.length}`);
    console.log(`[TUTOR CONV] user turns:  ${responseData.turn_count}`);
    console.log(`========== [getConversation] END ==========\n`);

    return res.status(200).json(new ApiResponse(200, responseData, "Conversation fetched"));
  }

  /* ── AI Practice ── (unchanged) ── */
  if (source === "practice") {
    const rows = await PracticeLog.findAll({
      where:      { conversation_id, user_id },
      order:      [["created_at", "ASC"]],
      attributes: ["id", "conversation_id", "request_body", "response_body", "device", "created_at"],
    });

    if (!rows.length) throw new ApiError(404, "Conversation not found");

    const last  = rows[rows.length - 1];
    const title = extractTitle(last.request_body) || "Practice session";

    const messages = rows.flatMap(r => {
      const req_body = typeof r.request_body  === "string" ? JSON.parse(r.request_body  || "{}") : (r.request_body  || {});
      const res_body = typeof r.response_body === "string" ? JSON.parse(r.response_body || "{}") : (r.response_body || {});
      const out = [];
      if (Array.isArray(req_body))               out.push(...req_body);
      else if (Array.isArray(req_body.messages)) out.push(...req_body.messages);
      else if (req_body.question || req_body.prompt)
        out.push({ role: "user", content: req_body.question || req_body.prompt });
      const answer = res_body.answer || res_body.response || res_body.content || res_body.text;
      if (answer) out.push({ role: "assistant", content: answer });
      return out;
    });

    return res.status(200).json(new ApiResponse(200, {
      conversation_id,
      source:      "AI Practice",
      redirect_to: "/ai-practice",
      title,
      messages,
      turn_count: messages.filter(m => m.role === "user").length,
      started_at: rows[0].created_at,
      updated_at: last.created_at,
    }, "Conversation fetched"));
  }

  throw new ApiError(400, `Unknown source "${source}". Use gini, tutor, or practice.`);
});

/* =====================================================
   9. GET LATEST TESTS
      GET /api/history/latest-tests
      (unchanged)
   ===================================================== */
export const getLatestTests = asyncHandler(async (req, res) => {
  const user_id    = Number(req.user.user_id);
  const student_id = user_id;

  const results = await sequelize.query(
    `SELECT
       pt.subject,
       ROUND(AVG(pq.is_correct) * 100) AS score
     FROM practice_tests pt
     JOIN practice_questions pq ON pt.id = pq.test_id
     WHERE pt.student_id = :student_id
     GROUP BY pt.id
     ORDER BY pt.created_at DESC`,
    { replacements: { student_id }, type: sequelize.QueryTypes.SELECT }
  );

  return res.status(200).json(
    new ApiResponse(200, results, "Latest tests fetched")
  );
});