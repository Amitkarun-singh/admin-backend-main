import { Op } from "sequelize";
import sequelize from "../config/db.js";

import GiniLog       from "../models/gini_log.model.js";
import PracticeLog   from "../models/practice_log.model.js";
import AiUsageLog    from "../models/ai_usage_log.model.js";
import UserSession   from "../models/user_session.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import StudentProfile from "../models/student_profile.model.js";

import { ApiError }    from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ─────────────────────────────────────────────────────────────
   HELPER: parse device string from User-Agent header
   Returns "Desktop" | "Mobile" | "Tablet"
───────────────────────────────────────────────────────────── */
function parseDevice(ua = "") {
  if (!ua) return "Desktop";
  const s = ua.toLowerCase();
  if (s.includes("tablet") || s.includes("ipad")) return "Tablet";
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone")) return "Mobile";
  return "Desktop";
}

/* ─────────────────────────────────────────────────────────────
   HELPER: extract a readable query label from request_body JSON.
   request_body can be  { question, topic, subject, prompt, … }
   or an array of message objects { role, content }.
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   HELPER: extract the FIRST user message as conversation title.
   Tries multiple storage formats used by different AI features.
───────────────────────────────────────────────────────────── */
function extractTitle(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj) return null;

    // Format 1 — single message object { role:"user", content:"..." }
    if (obj.role === "user" && obj.content) {
      const c = obj.content;
      if (typeof c === "string" && c.trim()) return c.trim().slice(0, 100);
      if (Array.isArray(c)) {
        const part = c.find(p => p?.type === "text" && p?.text);
        if (part?.text) return part.text.trim().slice(0, 100);
      }
    }

    // Format 2 — array of messages [{ role, content }, ...]
    const arr = Array.isArray(obj)
      ? obj
      : Array.isArray(obj.messages)
      ? obj.messages
      : null;

    if (arr) {
      const firstUser = arr.find(m => m?.role === "user");
      if (firstUser?.content) {
        const c = firstUser.content;
        if (typeof c === "string" && c.trim()) return c.trim().slice(0, 100);
        if (Array.isArray(c)) {
          const part = c.find(p => p?.type === "text" && p?.text);
          if (part?.text) return part.text.trim().slice(0, 100);
        }
      }
    }

    // Format 3 — flat payload { question, prompt, topic, … }
    const flat =
      obj.question ?? obj.prompt ?? obj.topic ??
      obj.query    ?? obj.message ?? obj.input ?? obj.text;
    if (flat && typeof flat === "string" && flat.trim())
      return flat.trim().slice(0, 100);

    return null;   // ← no last-resort guessing that picks up IDs/timestamps
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPER: parse full messages array for conversation restore
───────────────────────────────────────────────────────────── */
function parseMessages(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.messages)) return parsed.messages;
    return [];
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPER: human-readable relative time
   e.g. "2 hours ago", "Yesterday", "3 days ago"
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

/* =====================================================
   1. RECORD SESSION ON LOGIN
      Called from auth.controller.js login()
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
    // Never crash the login flow — just log
    console.error("recordSession failed:", err.message);
  }
};

/* =====================================================
   2. CLOSE SESSION ON LOGOUT
      Called from auth.controller.js logout()
   ===================================================== */
export const closeSession = async (user_id) => {
  try {
    // Close the latest open session for this user
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
   3. GET RECENT QUERIES
      GET /api/history/recent-queries
      Pulls from GiniLog + PracticeLog + AiUsageLog
      Returns last 20 entries across all features.
   ===================================================== */
export const getRecentQueries = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);   // ← cast to plain Number
  const limit   = parseInt(req.query.limit) || 20;

  console.log("🔍 getRecentQueries → user_id:", user_id, typeof user_id);

  /* ── AI Gini ──
     Each row = one message turn. Group by conversation_id so we
     show ONE card per conversation, ordered by latest activity.  */

  // Step 1: get unique conversations ordered by most recent activity
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

  // Step 2: for each conversation fetch the FIRST row (first user message → title)
  const giniQueries = await Promise.all(
    giniConvs.map(async conv => {
      // Fetch first few rows — find first user message for title
      const rows = await sequelize.query(
        `SELECT messages, subject, \`class\`
         FROM   chatbot_logs
         WHERE  conversation_id = :cid AND user_id = :uid
         ORDER  BY created_at ASC
         LIMIT  5`,
        {
          replacements: { cid: conv.conversation_id, uid: Number(user_id) },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      let title   = null;
      let subject = null;
      let cls     = null;

      for (const row of rows) {
        subject = subject || row.subject;
        cls     = cls     || row.class;
        if (!title && row.messages) {
          try {
            const msg = JSON.parse(row.messages);
            if (msg?.role === "user" && msg?.content) {
              title = String(msg.content).slice(0, 100);
            }
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
        class:           cls     || null,
        turn_count:      parseInt(conv.turn_count),
        time:            relativeTime(conv.last_active),
        created_at:      conv.last_active,
      };
    })
  );

  /* ── AI Practice logs ── */
  const practiceRows = await PracticeLog.findAll({
    where:  { user_id },
    order:  [["created_at", "DESC"]],
    limit,
    attributes: ["id", "conversation_id", "request_body", "created_at"],
  });

  const practiceQueries = practiceRows.map(r => ({
    source:          "AI Practice",
    redirect_to:     "/ai-practice",
    conversation_id: r.conversation_id,
    title:           extractTitle(r.request_body) || "Practice session",
    time:            relativeTime(r.created_at),
    created_at:      r.created_at,
  }));

  /* ── AI Notes + Doc Summariser (from AiUsageLog) ── */
  const usageRows = await AiUsageLog.findAll({
    where: {
      user_id,
      feature: { [Op.in]: ["ai_notes", "summarizer"] },
    },
    order: [["created_at", "DESC"]],
    limit,
    attributes: ["id", "feature", "action", "request_payload", "created_at"],
  });

  const usageQueries = usageRows.map(r => {
    const payload = r.request_payload || {};
    const isNotes = r.feature === "ai_notes";
    return {
      source:          isNotes ? "AI Notes" : "Doc Summariser",
      redirect_to:     isNotes ? "/ai-notes" : "/doc-summariser",
      conversation_id: null,
      title:           payload.topic || payload.subject ||
                       payload.chapter || r.action ||
                       (isNotes ? "AI Notes session" : "Doc Summariser session"),
      time:            relativeTime(r.created_at),
      created_at:      r.created_at,
    };
  });

  /* ── Merge + sort by most recent ── */
  const combined = [...giniQueries, ...practiceQueries, ...usageQueries]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map(({ created_at, ...rest }) => rest); // strip raw date from response

  return res.status(200).json(
    new ApiResponse(200, combined, "Recent queries fetched")
  );
});

/* =====================================================
   4. GET FEATURES EXPLORED
      GET /api/history/features-explored
      Returns per-feature use count + last used time.
   ===================================================== */
export const getFeaturesExplored = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  /* ── Gini count ── */
  const giniCount = await GiniLog.count({ where: { user_id } });
  const giniLast  = await GiniLog.findOne({
    where: { user_id }, order: [["created_at", "DESC"]],
    attributes: ["created_at"],
  });

  /* ── Practice count ── */
  const practiceCount = await PracticeLog.count({ where: { user_id } });
  const practiceLast  = await PracticeLog.findOne({
    where: { user_id }, order: [["created_at", "DESC"]],
    attributes: ["created_at"],
  });

  /* ── AI Notes count — only final fetch rows, not dropdown calls ── */
  const aiNotesCount = await AiUsageLog.count({
    where: {
      user_id,
      feature:  "ai_notes",
      endpoint: { [Op.notLike]: "/api/ainote/%" },
    },
  });
  const aiNotesLast = await AiUsageLog.findOne({
    where: {
      user_id,
      feature:  "ai_notes",
      endpoint: { [Op.notLike]: "/api/ainote/%" },
    },
    order:      [["created_at", "DESC"]],
    attributes: ["created_at"],
  });

  /* ── Doc Summariser count ── */
  const summaryCount = await AiUsageLog.count({
    where: { user_id, feature: "summarizer" },
  });
  const summaryLast = await AiUsageLog.findOne({
    where:      { user_id, feature: "summarizer" },
    order:      [["created_at", "DESC"]],
    attributes: ["created_at"],
  });

  const features = [
    {
      feature:   "AI Gini",
      uses:      giniCount,
      last_used: giniLast?.created_at ? relativeTime(giniLast.created_at) : "Never",
    },
    {
      feature:   "AI Notes",
      uses:      aiNotesCount,
      last_used: aiNotesLast?.created_at ? relativeTime(aiNotesLast.created_at) : "Never",
    },
    {
      feature:   "AI Practice",
      uses:      practiceCount,
      last_used: practiceLast?.created_at ? relativeTime(practiceLast.created_at) : "Never",
    },
    {
      feature:   "Doc Summariser",
      uses:      summaryCount,
      last_used: summaryLast?.created_at ? relativeTime(summaryLast.created_at) : "Never",
    },
  ];

  return res.status(200).json(
    new ApiResponse(200, features, "Features explored fetched")
  );
});

/* =====================================================
   5. GET LOGIN HISTORY
      GET /api/history/login-history
      Returns last N login sessions for the user.
   ===================================================== */
export const getLoginHistory = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);
  const limit   = parseInt(req.query.limit) || 10;

  const sessions = await UserSession.findAll({
    where: { user_id },
    order: [["login_at", "DESC"]],
    limit,
    attributes: ["session_id", "login_at", "logout_at", "device", "ip_address", "city", "country"],
  });

  const history = sessions.map(s => ({
    session_id: s.session_id,
    date:       new Date(s.login_at).toLocaleDateString("en-IN", {
                  month: "short", day: "numeric", year: "numeric"
                }),
    time:       new Date(s.login_at).toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit"
                }),
    device:     s.device || "Desktop",
    location:   s.city && s.country
                  ? `${s.city}, ${s.country}`
                  : s.ip_address || "Unknown",
    logout_at:  s.logout_at,
  }));

  return res.status(200).json(
    new ApiResponse(200, history, "Login history fetched")
  );
});

/* =====================================================
   6. GET WEEK ACTIVITY
      GET /api/history/week-activity
      Returns S M T W T F S active/inactive for
      the current week (Monday-based).
   ===================================================== */
export const getWeekActivity = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  // Start of current week (Sunday)
  const now       = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
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

  // Build a Set of active day indices (0=Sun … 6=Sat)
  const activeDays = new Set(
    sessions.map(s => new Date(s.login_at).getDay())
  );

  const days = ["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => ({
    label,
    active: activeDays.has(idx),
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      days,
      total_active: activeDays.size,
    }, "Week activity fetched")
  );
});

/* =====================================================
   7. GET STATS
      GET /api/history/stats
      Returns loginDayCount (streak) + overall score.
   ===================================================== */
/* =====================================================
   8. GET FULL CONVERSATION
      GET /api/history/conversation/:conversation_id?source=gini
      GET /api/history/conversation/:conversation_id?source=practice
      Called when user clicks a recent query card.
      Returns full messages + metadata so frontend can
      restore the conversation in the correct tab.
   ===================================================== */
export const getConversation = asyncHandler(async (req, res) => {
  const user_id         = Number(req.user.user_id);
  const { conversation_id } = req.params;
  const source          = (req.query.source || "gini").toLowerCase();

  if (!conversation_id) throw new ApiError(400, "conversation_id required");

  /* ── AI Gini ── */
  if (source === "gini") {
    const allRows = await sequelize.query(
      `SELECT messages, response_body, subject, \`class\`, language, created_at
       FROM   chatbot_logs
       WHERE  conversation_id = :cid
         AND  user_id = :uid
       ORDER  BY created_at ASC`,
      {
        replacements: { cid: conversation_id, uid: Number(user_id) },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!allRows.length) throw new ApiError(404, "Conversation not found");

    /* Each row = one turn.
       messages      → user message   { id, role:"user", content }
       response_body → AI reply       (string | JSON with various shapes) */
    const messages = [];

    for (const row of allRows) {
      // ── 1. User message ──
      try {
        const userMsg = JSON.parse(row.messages || "{}");
        if (userMsg?.content !== undefined) {
          messages.push({ role: "user", content: userMsg.content });
        }
      } catch { /* skip */ }

      // ── 2. Assistant response ──
      if (row.response_body) {
        try {
          const rb = JSON.parse(row.response_body);

          // OpenAI / OpenRouter format
          const oaiContent = rb?.choices?.[0]?.message?.content;
          if (oaiContent) {
            messages.push({ role: "assistant", content: oaiContent });
            continue;
          }

          // Flat formats
          const flat =
            rb?.response ?? rb?.answer ?? rb?.content ??
            rb?.text      ?? rb?.reply  ?? rb?.message;
          if (flat && typeof flat === "string") {
            messages.push({ role: "assistant", content: flat });
            continue;
          }

          // response_body is already a plain string wrapped in JSON
          if (typeof rb === "string" && rb.trim()) {
            messages.push({ role: "assistant", content: rb });
          }
        } catch {
          // response_body is a plain text string (not JSON)
          const plain = String(row.response_body).trim();
          if (plain) messages.push({ role: "assistant", content: plain });
        }
      }
    }

    const firstRow  = allRows[0];
    const lastRow   = allRows[allRows.length - 1];
    const firstUser = messages.find(m => m.role === "user");
    const title     = firstUser?.content?.slice(0, 100)
                        || firstRow?.subject
                        || "AI Gini conversation";

    return res.status(200).json(new ApiResponse(200, {
      conversation_id,
      source:      "AI Gini",
      redirect_to: "/ai-gini",
      title,
      subject:     firstRow.subject  || null,
      class:       firstRow.class    || null,
      language:    firstRow.language || null,
      messages,
      turn_count:  messages.filter(m => m.role === "user").length,
      started_at:  firstRow.created_at,
      updated_at:  lastRow.created_at,
    }, "Conversation fetched"));
  }

  /* ── AI Practice ── */
  if (source === "practice") {
    const rows = await PracticeLog.findAll({
      where:   { conversation_id, user_id },
      order:   [["created_at", "ASC"]],
      attributes: ["id", "conversation_id", "request_body",
                   "response_body", "device", "created_at"],
    });

    if (!rows.length) throw new ApiError(404, "Conversation not found");

    const last  = rows[rows.length - 1];
    const title = extractTitle(last.request_body) || "Practice session";

    // Build a messages array from request / response pairs
    const messages = rows.flatMap(r => {
      const req_body  = typeof r.request_body  === "string"
        ? JSON.parse(r.request_body  || "{}") : (r.request_body  || {});
      const res_body  = typeof r.response_body === "string"
        ? JSON.parse(r.response_body || "{}") : (r.response_body || {});

      const out = [];

      // if request_body itself is a messages array, spread it
      if (Array.isArray(req_body)) {
        out.push(...req_body);
      } else if (Array.isArray(req_body.messages)) {
        out.push(...req_body.messages);
      } else if (req_body.question || req_body.prompt) {
        out.push({ role: "user", content: req_body.question || req_body.prompt });
      }

      // attach AI response if present
      const answer = res_body.answer || res_body.response ||
                     res_body.content || res_body.text;
      if (answer) out.push({ role: "assistant", content: answer });

      return out;
    });

    return res.status(200).json(new ApiResponse(200, {
      conversation_id,
      source:      "AI Practice",
      redirect_to: "/ai-practice",
      title,
      messages,
      turn_count:  messages.filter(m => m.role === "user").length,
      started_at:  rows[0].created_at,
      updated_at:  last.created_at,
    }, "Conversation fetched"));
  }

  throw new ApiError(400, `Unknown source "${source}". Use gini or practice.`);
});

export const getStats = asyncHandler(async (req, res) => {
  const user_id = Number(req.user.user_id);

  /* ── Distinct login days (all time) ── */
  const loginResult = await sequelize.query(
    `SELECT COUNT(DISTINCT DATE(login_at)) AS cnt
     FROM user_sessions
     WHERE user_id = :user_id`,
    { replacements: { user_id }, type: sequelize.QueryTypes.SELECT }
  );
  const loginDays = parseInt(loginResult[0]?.cnt) || 0;

  /* ── Student analytics score (if role is STUDENT) ── */
  let testOverall = 0;
  try {
    const student = await StudentProfile.findOne({ where: { user_id } });
    if (student) {
      const analytics = await StudentAnalytics.findOne({
        where: { student_id: student.student_id },
      });
      testOverall = analytics?.ai_practice_score
        ? parseFloat(analytics.ai_practice_score)
        : 0;
    }
  } catch {
    // non-student user — score stays 0
  }

  return res.status(200).json(
    new ApiResponse(200, {
      login_days:   loginDays,
      test_overall: testOverall,
    }, "Stats fetched")
  );
});