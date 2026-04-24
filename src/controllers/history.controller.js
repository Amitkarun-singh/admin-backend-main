import { Op } from "sequelize";
import sequelize from "../config/db.js";

import GiniLog from "../models/gini_log.model.js";
import TutorLog from "../models/Tutor_log.model.js";
import PracticeLog from "../models/practice_log.model.js";
import AiUsageLog from "../models/ai_usage_log.model.js";
import UserSession from "../models/user_session.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import StudentProfile from "../models/student_profile.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ─────────────────────────────────────────────────────────────
   TUTOR USER MATCH
   user_details stores JWT payload:
   {"user_id":32,"role":"STUDENT","school_id":22, ...}
───────────────────────────────────────────────────────────── */
const TUTOR_UID = `CAST(JSON_UNQUOTE(JSON_EXTRACT(user_details, '$.user_id')) AS UNSIGNED)`;

/* ─────────────────────────────────────────────────────────────
   HELPER: parse device string
───────────────────────────────────────────────────────────── */
function parseDevice(ua = "") {
  if (!ua) return "Desktop";
  const s = ua.toLowerCase();
  if (s.includes("tablet") || s.includes("ipad")) return "Tablet";
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone"))
    return "Mobile";
  return "Desktop";
}

/* ─────────────────────────────────────────────────────────────
   HELPER: extract conversation title from any message format
───────────────────────────────────────────────────────────── */
function extractTitle(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj) return null;

    if (obj.role === "user" && obj.content) {
      const c = obj.content;
      if (typeof c === "string" && c.trim()) return c.trim().slice(0, 100);
      if (Array.isArray(c)) {
        const part = c.find((p) => p?.type === "text" && p?.text);
        if (part?.text) return part.text.trim().slice(0, 100);
      }
    }

    const arr = Array.isArray(obj)
      ? obj
      : Array.isArray(obj.messages)
        ? obj.messages
        : null;

    if (arr) {
      const firstUser = arr.find((m) => m?.role === "user");
      if (firstUser?.content) {
        const c = firstUser.content;
        if (typeof c === "string" && c.trim()) return c.trim().slice(0, 100);
        if (Array.isArray(c)) {
          const part = c.find((p) => p?.type === "text" && p?.text);
          if (part?.text) return part.text.trim().slice(0, 100);
        }
      }
    }

    const flat =
      obj.question ??
      obj.prompt ??
      obj.topic ??
      obj.query ??
      obj.message ??
      obj.input ??
      obj.text;
    if (flat && typeof flat === "string" && flat.trim())
      return flat.trim().slice(0, 100);

    return null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPER: extract title specifically from a tutor_logs row.

   Your actual tutor_logs structure:
     request_body = { "message": "[{\"role\":\"user\",\"content\":\"hi\"}, ...]" }
     response_body = NULL  (AI response not stored here)

   So the conversation history lives in request_body.message
   as a JSON-encoded string of the messages array.
───────────────────────────────────────────────────────────── */
function extractTutorTitle(row) {
  try {
    const rb = typeof row.request_body === "string"
      ? JSON.parse(row.request_body)
      : row.request_body;

    if (!rb) return null;

    // Your format: { message: "[{role, content}, ...]" }
    if (rb.message && typeof rb.message === "string") {
      const msgs = JSON.parse(rb.message);
      if (Array.isArray(msgs)) {
        const firstUser = msgs.find(m => m?.role === "user");
        if (firstUser?.content && typeof firstUser.content === "string")
          return firstUser.content.trim().slice(0, 100);
      }
    }

    // Fallback: try other known fields
    const flat =
      rb.question ?? rb.prompt ?? rb.query ??
      rb.topic    ?? rb.input  ?? rb.text;
    if (flat && typeof flat === "string") return flat.trim().slice(0, 100);

  } catch { /* ignore parse errors */ }

  return null;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: parse ALL messages from a single tutor_logs row.

   Each row's request_body.message contains the FULL conversation
   history up to that point (cumulative). To avoid duplicates we
   only read the LAST row of a conversation (which has the full history)
   for the full conversation view, but for recent queries we just
   need the first user message as the title.
───────────────────────────────────────────────────────────── */
function parseTutorMessages(row) {
  const messages = [];
  try {
    const rb = typeof row.request_body === "string"
      ? JSON.parse(row.request_body)
      : row.request_body;

    if (!rb) return messages;

    // Primary format: { message: "[{role, content}, ...]" }
    if (rb.message && typeof rb.message === "string") {
      const msgs = JSON.parse(rb.message);
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          if (m?.role && m?.content !== undefined) {
            messages.push({ role: m.role, content: m.content });
          }
        }
        return messages; // return early — this is the full history
      }
    }

    // Fallback: flat request formats
    const text = rb.question ?? rb.prompt ?? rb.query ?? rb.input ?? rb.text;
    if (text && typeof text === "string")
      messages.push({ role: "user", content: text });

  } catch { /* ignore */ }

  return messages;
}

/* ─────────────────────────────────────────────────────────────
   HELPER: relative time
───────────────────────────────────────────────────────────── */
function relativeTime(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffH < 24) return `${diffH} hour${diffH > 1 ? "s" : ""} ago`;
  if (diffD === 1) return "Yesterday";
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
      login_at: new Date(),
      device: parseDevice(ua),
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

      Tutor: one card per unique conversation_id.
      Title comes from the FIRST row's request_body.message[0].
      Turn count = number of rows for that conversation_id.
   ===================================================== */
export const getRecentQueries = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
  const limit = parseInt(req.query.limit) || 20;

  /* ── AI Gini ── */
  const giniConvs = await GiniLog.findAll({
    where: { user_id },
    attributes: [
      "conversation_id",
      [sequelize.fn("MAX", sequelize.col("created_at")), "last_active"],
      [sequelize.fn("COUNT", sequelize.col("id")), "turn_count"],
    ],
    group: ["conversation_id"],
    order: [[sequelize.fn("MAX", sequelize.col("created_at")), "DESC"]],
    limit,
    raw: true,
  });

  const giniQueries = await Promise.all(
    giniConvs.map(async (conv) => {
      const rows = await sequelize.query(
        `SELECT messages, subject, \`class\`
         FROM   chatbot_logs
         WHERE  conversation_id = :cid AND user_id = :uid
         ORDER  BY created_at ASC
         LIMIT  5`,
        {
          replacements: { cid: conv.conversation_id, uid: user_id },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      let title = null,
        subject = null,
        cls = null;
      for (const row of rows) {
        subject = subject || row.subject;
        cls = cls || row.class;
        if (!title && row.messages) {
          try {
            const msg = JSON.parse(row.messages);
            if (msg?.role === "user" && msg?.content)
              title = String(msg.content).slice(0, 100);
          } catch {
            /* skip */
          }
        }
        if (title) break;
      }

      return {
        source: "AI Gini",
        redirect_to: "/ai-gini",
        conversation_id: conv.conversation_id,
        title: title || subject || "AI Gini conversation",
        subject: subject || null,
        class: cls || null,
        turn_count: parseInt(conv.turn_count),
        time: relativeTime(conv.last_active),
        created_at: conv.last_active,
      };
    }),
  );

  /* ── AI Tutor ──
     Group by conversation_id → one card per conversation.
     Fetch the FIRST row of each conversation to extract the title.
     turn_count = number of DB rows (each row = one user turn).          */
  let tutorQueries = [];
  try {
    const tutorConvs = await sequelize.query(
      `SELECT
         conversation_id,
         MAX(created_at) AS last_active,
         COUNT(id)       AS turn_count
       FROM   tutor_logs
       WHERE  ${TUTOR_UID} = :uid
       GROUP  BY conversation_id
       ORDER  BY MAX(created_at) DESC
       LIMIT  :lim`,
      {
        replacements: { uid: user_id, lim: limit },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    tutorQueries = await Promise.all(
      tutorConvs.map(async conv => {
        // Get the earliest row — has the first user message
        const [firstRow] = await sequelize.query(
          `SELECT request_body
           FROM   tutor_logs
           WHERE  conversation_id = :cid
             AND  ${TUTOR_UID} = :uid
           ORDER  BY created_at ASC
           LIMIT  1`,
          {
            replacements: { cid: conv.conversation_id, uid: user_id },
            type: sequelize.QueryTypes.SELECT,
          },
        );

        const title = firstRow
          ? (extractTutorTitle(firstRow) || "AI Tutor conversation")
          : "AI Tutor conversation";

        return {
          source: "AI Tutor",
          redirect_to: "/ai-tutor",
          conversation_id: conv.conversation_id,
          title,
          turn_count: parseInt(conv.turn_count),
          time: relativeTime(conv.last_active),
          created_at: conv.last_active,
        };
      }),
    );
  } catch (err) {
    console.error("getRecentQueries — tutor fetch failed:", err.message);
  }

  /* ── Merge, sort newest-first, strip raw date ── */
  const combined = [...giniQueries, ...tutorQueries]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map(({ created_at, ...rest }) => rest);

  return res
    .status(200)
    .json(new ApiResponse(200, combined, "Recent queries fetched"));
});

/* =====================================================
   4. GET FEATURES EXPLORED
      GET /api/history/features-explored
   ===================================================== */
export const getFeaturesExplored = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  /* ── Gini ── */
  const giniCount = await GiniLog.count({ where: { user_id } });
  const giniLast = await GiniLog.findOne({
    where: { user_id },
    order: [["created_at", "DESC"]],
    attributes: ["created_at"],
  });

  /* ── AI Tutor ── */
  let tutorCount = 0, tutorLastDate = null;
  try {
    const [countRow] = await sequelize.query(
      `SELECT COUNT(id) AS cnt FROM tutor_logs WHERE ${TUTOR_UID} = :uid`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    tutorCount = parseInt(countRow?.cnt) || 0;

    const [lastRow] = await sequelize.query(
      `SELECT created_at FROM tutor_logs
       WHERE  ${TUTOR_UID} = :uid
       ORDER  BY created_at DESC LIMIT 1`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    tutorLastDate = lastRow?.created_at || null;
  } catch (err) {
    console.error("getFeaturesExplored — tutor fetch failed:", err.message);
  }

  /* ── AI Practice ── */
  const practiceCount = await PracticeLog.count({ where: { user_id } });
  const practiceLast  = await PracticeLog.findOne({
    where: { user_id }, order: [["created_at", "DESC"]],
  });

  /* ── AI Notes ── */
  const aiNotesWhere = {
    user_id,
    feature: "ai_notes",
    [Op.or]: [
      { endpoint: { [Op.notLike]: "/api/ainote/%" } },
      { endpoint: null },
    ],
  };
  const aiNotesCount = await AiUsageLog.count({ where: aiNotesWhere });
  const aiNotesLast  = await AiUsageLog.findOne({
    where: aiNotesWhere, order: [["created_at", "DESC"]],
  });

  /* ── Doc Summariser ── */
  const summaryCount = await AiUsageLog.count({
    where: { user_id, feature: "summarizer" },
  });
  const summaryLast  = await AiUsageLog.findOne({
    where: { user_id, feature: "summarizer" }, order: [["created_at", "DESC"]],
  });

  const features = [
    {
      feature: "AI Gini",
      uses: giniCount,
      last_used: getCreatedAt(giniLast)
        ? relativeTime(getCreatedAt(giniLast))
        : "Never",
    },
    {
      feature: "AI Tutor",
      uses: tutorCount,
      last_used: tutorLastDate ? relativeTime(tutorLastDate) : "Never",
    },
    {
      feature: "AI Notes",
      uses: aiNotesCount,
      last_used: getCreatedAt(aiNotesLast)
        ? relativeTime(getCreatedAt(aiNotesLast))
        : "Never",
    },
    {
      feature: "AI Practice",
      uses: practiceCount,
      last_used: getCreatedAt(practiceLast)
        ? relativeTime(getCreatedAt(practiceLast))
        : "Never",
    },
    {
      feature: "Doc Summariser",
      uses: summaryCount,
      last_used: getCreatedAt(summaryLast)
        ? relativeTime(getCreatedAt(summaryLast))
        : "Never",
    },
  ];

  return res
    .status(200)
    .json(new ApiResponse(200, features, "Features explored fetched"));
});

/* =====================================================
   5. GET LOGIN HISTORY
      GET /api/history/login-history
   ===================================================== */
export const getLoginHistory = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
  const limit = parseInt(req.query.limit) || 10;

  const sessions = await UserSession.findAll({
    where: { user_id },
    order: [["login_at", "DESC"]],
    limit,
    attributes: [
      "session_id",
      "login_at",
      "logout_at",
      "device",
      "ip_address",
      "city",
      "country",
    ],
  });

  const history = sessions.map((s) => ({
    session_id: s.session_id,
    date: new Date(s.login_at).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }),
    time: new Date(s.login_at).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    }),
    device: s.device || "Desktop",
    location:
      s.city && s.country
        ? `${s.city}, ${s.country}`
        : s.ip_address || "Unknown",
    logout_at: s.logout_at,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, history, "Login history fetched"));
});

/* =====================================================
   6. GET WEEK ACTIVITY
      GET /api/history/week-activity
   ===================================================== */
export const getWeekActivity = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const sessions = await UserSession.findAll({
    where: {
      user_id,
      login_at: { [Op.between]: [weekStart, weekEnd] },
    },
    attributes: ["login_at"],
    raw: true,
  });

  const activeDays = new Set(sessions.map(s => new Date(s.login_at).getDay()));

  const days = ["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => ({
    label,
    active: activeDays.has(idx),
  }));

  return res.status(200).json(
    new ApiResponse(200, { days, total_active: activeDays.size }, "Week activity fetched")
  );
});

/* =====================================================
   7. GET STATS
      GET /api/history/stats
   ===================================================== */
export const getStats = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  const loginResult = await sequelize.query(
    `SELECT COUNT(DISTINCT DATE(login_at)) AS cnt
     FROM user_sessions WHERE user_id = :user_id`,
    { replacements: { user_id }, type: sequelize.QueryTypes.SELECT }
  );
  const loginDays = parseInt(loginResult[0]?.cnt) || 0;

  let testOverall = 0;
  try {
    const student = await StudentProfile.findOne({ where: { user_id } });
    if (student) {
      const analytics = await StudentAnalytics.findOne({
        where: { student_id: student.student_id },
      });
      testOverall = analytics?.ai_practice_score
        ? parseFloat(analytics.ai_practice_score) : 0;
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
         ?source=tutor
         ?source=practice

   TUTOR LOGIC:
   ─────────────────────────────────────────────────────
   Each row in tutor_logs = one user turn.
   request_body.message = JSON string of the FULL messages
   array up to that point (cumulative, like ChatGPT context).

   Strategy: take only the LAST row of the conversation —
   it has the most complete message history. Parse its
   request_body.message to get all user + assistant turns.

   This avoids duplicating messages that appear in every row.
   ───────────────────────────────────────────────────── */
export const getConversation = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
  const { conversation_id } = req.params;
  const source = (req.query.source || "gini").toLowerCase();

  if (!conversation_id) throw new ApiError(400, "conversation_id required");

  /* ── AI Gini ── */
  if (source === "gini") {
    const allRows = await sequelize.query(
      `SELECT messages, response_body, subject, \`class\`, language, created_at
       FROM   chatbot_logs
       WHERE  conversation_id = :cid AND user_id = :uid
       ORDER  BY created_at ASC`,
      {
        replacements: { cid: conversation_id, uid: user_id },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!allRows.length) throw new ApiError(404, "Conversation not found");

    const messages = [];
    for (const row of allRows) {
      try {
        const userMsg = JSON.parse(row.messages || "{}");
        if (userMsg?.content !== undefined)
          messages.push({ role: "user", content: userMsg.content });
      } catch {
        /* skip */
      }

      if (row.response_body) {
        try {
          const rb = JSON.parse(row.response_body);
          const oaiContent = rb?.choices?.[0]?.message?.content;
          if (oaiContent) {
            messages.push({ role: "assistant", content: oaiContent });
            continue;
          }

          const flat =
            rb?.response ??
            rb?.answer ??
            rb?.content ??
            rb?.text ??
            rb?.reply ??
            rb?.message;
          if (flat && typeof flat === "string") {
            messages.push({ role: "assistant", content: flat });
            continue;
          }

          if (typeof rb === "string" && rb.trim())
            messages.push({ role: "assistant", content: rb });
        } catch {
          const plain = String(row.response_body).trim();
          if (plain) messages.push({ role: "assistant", content: plain });
        }
      }
    }

    const firstRow = allRows[0];
    const lastRow = allRows[allRows.length - 1];
    const firstUser = messages.find((m) => m.role === "user");
    const title =
      firstUser?.content?.slice(0, 100) ||
      firstRow?.subject ||
      "AI Gini conversation";

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversation_id,
          source: "AI Gini",
          redirect_to: "/ai-gini",
          title,
          subject: firstRow.subject || null,
          class: firstRow.class || null,
          language: firstRow.language || null,
          messages,
          turn_count: messages.filter((m) => m.role === "user").length,
          started_at: firstRow.created_at,
          updated_at: lastRow.created_at,
        },
        "Conversation fetched",
      ),
    );
  }

  /* ── AI Tutor ── */
  if (source === "tutor") {
    // Get all rows so we know start/end times and turn count
    const allRows = await sequelize.query(
      `SELECT id, request_body, response_body, created_at
       FROM   tutor_logs
       WHERE  conversation_id = :cid
         AND  ${TUTOR_UID} = :uid
       ORDER  BY created_at ASC`,
      {
        replacements: { cid: conversation_id, uid: user_id },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!allRows.length) throw new ApiError(404, "Conversation not found");

    const firstRow = allRows[0];
    const lastRow  = allRows[allRows.length - 1];

    /* ── Parse messages from the LAST row ──
       The last row contains the most complete cumulative history.
       request_body.message is a JSON string of [{role, content}, ...].
       This gives us all user + assistant turns in order.           */
    let messages = parseTutorMessages(lastRow);

    /* ── Fallback: if last row parsing fails, rebuild from all rows ──
       Each row = one user turn. We take only the NEW user message
       from each row (the last user message in the messages array)
       since earlier messages repeat across rows.                     */
    if (!messages.length) {
      for (const row of allRows) {
        try {
          const rb = typeof row.request_body === "string"
            ? JSON.parse(row.request_body) : row.request_body;

          if (rb?.message && typeof rb.message === "string") {
            const msgs = JSON.parse(rb.message);
            if (Array.isArray(msgs)) {
              // Find the last user message — this is the new message for this turn
              const lastUser = [...msgs].reverse().find(m => m?.role === "user");
              if (lastUser?.content)
                messages.push({ role: "user", content: lastUser.content });

              // Also grab the assistant response from response_body if available
              if (row.response_body) {
                try {
                  const res_body = typeof row.response_body === "string"
                    ? JSON.parse(row.response_body) : row.response_body;
                  const assistantText =
                    res_body?.choices?.[0]?.message?.content ??
                    res_body?.response ?? res_body?.answer ??
                    res_body?.content  ?? res_body?.text;
                  if (assistantText && typeof assistantText === "string")
                    messages.push({ role: "assistant", content: assistantText });
                } catch { /* no response */ }
              }
            }
          }
        } catch { /* skip malformed row */ }
      }
    }

    const title = extractTutorTitle(firstRow) || "AI Tutor conversation";

    return res.status(200).json(new ApiResponse(200, {
      conversation_id,
      source:      "AI Tutor",
      redirect_to: "/ai-tutor",
      title,
      messages,
      turn_count:  messages.filter(m => m.role === "user").length,
      started_at:  firstRow.created_at,
      updated_at:  lastRow.created_at,
    }, "Conversation fetched"));
  }

  /* ── AI Practice ── */
  if (source === "practice") {
    const rows = await PracticeLog.findAll({
      where: { conversation_id, user_id },
      order: [["created_at", "ASC"]],
      attributes: [
        "id",
        "conversation_id",
        "request_body",
        "response_body",
        "device",
        "created_at",
      ],
    });

    if (!rows.length) throw new ApiError(404, "Conversation not found");

    const last = rows[rows.length - 1];
    const title = extractTitle(last.request_body) || "Practice session";

    const messages = rows.flatMap((r) => {
      const req_body =
        typeof r.request_body === "string"
          ? JSON.parse(r.request_body || "{}")
          : r.request_body || {};
      const res_body =
        typeof r.response_body === "string"
          ? JSON.parse(r.response_body || "{}")
          : r.response_body || {};
      const out = [];

      if (Array.isArray(req_body)) out.push(...req_body);
      else if (Array.isArray(req_body.messages)) out.push(...req_body.messages);
      else if (req_body.question || req_body.prompt)
        out.push({
          role: "user",
          content: req_body.question || req_body.prompt,
        });

      const answer =
        res_body.answer ||
        res_body.response ||
        res_body.content ||
        res_body.text;
      if (answer) out.push({ role: "assistant", content: answer });
      return out;
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversation_id,
          source: "AI Practice",
          redirect_to: "/ai-practice",
          title,
          messages,
          turn_count: messages.filter((m) => m.role === "user").length,
          started_at: rows[0].created_at,
          updated_at: last.created_at,
        },
        "Conversation fetched",
      ),
    );
  }

  throw new ApiError(
    400,
    `Unknown source "${source}". Use gini, tutor, or practice.`,
  );
});

/* =====================================================
   9. GET LATEST TESTS
      GET /api/history/latest-tests
   ===================================================== */
export const getLatestTests = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
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
    {
      replacements: { student_id },
      type: sequelize.QueryTypes.SELECT,
    },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, results, "Latest tests fetched"));
});
