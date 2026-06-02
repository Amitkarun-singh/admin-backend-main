import { ApiError } from "../utils/ApiError.js";
import { todayIST, calcStreak } from "../utils/streak.util.js";
import { historyRepository } from "../repositories/history.repository.js";

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const TUTOR_UID        = `CAST(JSON_UNQUOTE(JSON_EXTRACT(user_details, '$.user_id')) AS UNSIGNED)`;
const TUTOR_USER_MATCH = `(user_id = :uid OR ${TUTOR_UID} = :uid)`;

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function parseDevice(ua = ""): string {
  if (!ua) return "Desktop";
  const s = ua.toLowerCase();
  if (s.includes("tablet") || s.includes("ipad"))                             return "Tablet";
  if (s.includes("mobile") || s.includes("android") || s.includes("iphone")) return "Mobile";
  return "Desktop";
}

function isVoiceMessage(content: string): boolean {
  if (!content || typeof content !== "string") return true;
  const t = content.trim().toLowerCase();
  return t.startsWith("[voice") || t === "";
}

function extractUserQueryFromResponseBody(rawResponseBody: any): string | null {
  try {
    const rb = typeof rawResponseBody === "string" ? JSON.parse(rawResponseBody) : rawResponseBody;
    if (!rb) return null;
    if (rb.message && typeof rb.message === "object" && rb.message.userQuery)
      return String(rb.message.userQuery).trim() || null;
    if (rb.userQuery) return String(rb.userQuery).trim() || null;
  } catch { /* ignore */ }
  return null;
}

function parseTutorUserContent(rawRequestBody: any, rawResponseBody: any = null): string | null {
  try {
    const rb = typeof rawRequestBody === "string" ? JSON.parse(rawRequestBody) : rawRequestBody;
    if (!rb) return null;

    if (rb.role === "user" && rb.content !== undefined) {
      const content = String(rb.content).trim();
      if (isVoiceMessage(content) && rawResponseBody) {
        const userQuery = extractUserQueryFromResponseBody(rawResponseBody);
        if (userQuery) return userQuery;
      }
      return content || null;
    }

    if (rb.message && typeof rb.message === "string") {
      try {
        const msgs = JSON.parse(rb.message);
        if (Array.isArray(msgs)) {
          const firstUser = msgs.find((m: any) => m?.role === "user");
          const content   = firstUser?.content ? String(firstUser.content).trim() : null;
          if (content && isVoiceMessage(content) && rawResponseBody) {
            const userQuery = extractUserQueryFromResponseBody(rawResponseBody);
            if (userQuery) return userQuery;
          }
          return content;
        }
      } catch { /* not a JSON array */ }
    }
  } catch { /* ignore */ }
  return null;
}

function parseTutorAssistantContent(rawResponseBody: any): string | null {
  try {
    const rb = typeof rawResponseBody === "string" ? JSON.parse(rawResponseBody) : rawResponseBody;
    if (!rb) return null;
    if (rb.message && typeof rb.message === "object" && rb.message.content)
      return String(rb.message.content).trim() || null;
    if (rb.message && typeof rb.message === "string" && rb.message.trim())
      return rb.message.trim();
    if (rb.type === "final" && rb.content)
      return String(rb.content).trim() || null;
    const flat = rb.response ?? rb.answer ?? rb.content ?? rb.text ?? rb.reply;
    if (flat && typeof flat === "string") return flat.trim() || null;
  } catch { /* ignore */ }
  return null;
}

function buildTutorMessages(rows: any[]): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  for (const row of rows) {
    const userContent = parseTutorUserContent(row.request_body, row.response_body);
    if (userContent !== null) messages.push({ role: "user", content: userContent });
    const assistantContent = parseTutorAssistantContent(row.response_body);
    if (assistantContent !== null) messages.push({ role: "assistant", content: assistantContent });
  }
  return messages;
}

function extractTutorTitleFromRows(rows: any[]): string | null {
  let voiceFallback: string | null = null;
  for (const row of rows) {
    const content = parseTutorUserContent(row.request_body, row.response_body);
    if (!content) continue;
    if (!isVoiceMessage(content)) return content.slice(0, 100);
    if (!voiceFallback) voiceFallback = content.slice(0, 100);
  }
  return voiceFallback || null;
}

function extractTitle(raw: any): string | null {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj) return null;
    if (obj.role === "user" && obj.content) {
      const c = obj.content;
      if (typeof c === "string" && c.trim()) return c.trim().slice(0, 100);
    }
    const arr = Array.isArray(obj) ? obj : Array.isArray(obj.messages) ? obj.messages : null;
    if (arr) {
      const firstUser = arr.find((m: any) => m?.role === "user");
      if (firstUser?.content && typeof firstUser.content === "string")
        return firstUser.content.trim().slice(0, 100);
    }
    const flat = obj.question ?? obj.prompt ?? obj.topic ?? obj.query ?? obj.input ?? obj.text;
    if (flat && typeof flat === "string" && flat.trim()) return flat.trim().slice(0, 100);
    return null;
  } catch { return null; }
}

function parseMySQLDate(date: any): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null;
    const y  = date.getUTCFullYear();
    const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d  = String(date.getUTCDate()).padStart(2, "0");
    const h  = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const s  = String(date.getUTCSeconds()).padStart(2, "0");
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+05:30`);
  }
  const str = String(date);
  if (str.includes("Z") || /[+-]\d{2}:\d{2}$/.test(str)) return new Date(str);
  return new Date(str.replace(" ", "T") + "+05:30");
}

function relativeTime(date: any): string {
  const parsed = parseMySQLDate(date);
  if (!parsed || isNaN(parsed.getTime())) return "Unknown";

  const diffMs  = Date.now() - parsed.getTime();
  if (diffMs < 0) return "Just now";

  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);

  if (diffMin < 1)   return "Just now";
  if (diffMin < 60)  return `${diffMin} min ago`;
  if (diffH   < 24)  return `${diffH} hour${diffH > 1 ? "s" : ""} ago`;
  if (diffD   === 1) return "Yesterday";
  return `${diffD} days ago`;
}

function getCreatedAt(instance: any): any {
  if (!instance) return null;
  return instance.created_at ?? instance.createdAt ?? null;
}

/* ─────────────────────────────────────────────────────────────
   SERVICE
───────────────────────────────────────────────────────────── */
export class HistoryService {

  async recordSession({ user_id, ua, ip }: { user_id: number; ua: string; ip: string }): Promise<void> {
    try {
      await historyRepository.createSession({
        user_id,
        login_at:   new Date(),
        device:     parseDevice(ua),
        ip_address: ip || null,
      });
      await this.updateStreak(user_id);
    } catch (err: any) {
      console.error("recordSession failed:", err.message);
    }
  }

  async closeSession(user_id: number): Promise<void> {
    try {
      const session = await historyRepository.findOpenSession(user_id);
      if (session) {
        (session as any).logout_at = new Date();
        await (session as any).save();
      }
    } catch (err: any) {
      console.error("closeSession failed:", err.message);
    }
  }

  private async updateStreak(user_id: number): Promise<void> {
    try {
      const today  = todayIST();
      const row    = await historyRepository.findStreak(user_id);
      const update = calcStreak(row, today);

      if (!update) return;

      if (row) {
        await historyRepository.updateStreak(row, update);
      } else {
        await historyRepository.createStreak({ user_id, ...update });
      }
    } catch (err: any) {
      console.error(`[Streak] updateStreak failed for user ${user_id}:`, err.message);
    }
  }

  async getRecentQueries(user_id: number, limit: number): Promise<any[]> {
    const giniConvs = await historyRepository.getGiniConversations(user_id, limit);

    const giniQueries = await Promise.all(
      giniConvs.map(async (conv: any) => {
        const rows = await historyRepository.getGiniConversationRow(conv.conversation_id, user_id);
        const row: any = rows[0];
        let title: string | null = null;
        if (row?.messages) {
          try {
            const msg = JSON.parse(row.messages);
            if (msg?.role === "user" && msg?.content) title = String(msg.content).slice(0, 100);
          } catch { /* ignore */ }
        }
        return {
          source: "AI Gini", redirect_to: "/ai-gini",
          conversation_id: conv.conversation_id,
          title: title || row?.subject || "AI Gini conversation",
          subject: row?.subject || null,
          class: row?.class || null,
          turn_count: parseInt(conv.turn_count),
          time: relativeTime(conv.last_active),
          created_at: conv.last_active,
        };
      })
    );

    let tutorQueries: any[] = [];
    try {
      const tutorSessions = await historyRepository.getTutorSessions(user_id, limit, TUTOR_USER_MATCH);
      tutorQueries = (
        await Promise.all(
          tutorSessions.map(async (session: any) => {
            const titleRows = await historyRepository.getTutorSessionTitleRow(session.session_id, user_id, TUTOR_USER_MATCH);
            if (!titleRows.length) return null;
            return {
              source: "AI Tutor", redirect_to: "/ai-tutor",
              conversation_id: session.session_id,
              title: extractTutorTitleFromRows(titleRows) || "AI Tutor conversation",
              turn_count: parseInt(session.turn_count) || 0,
              time: relativeTime(session.last_active),
              created_at: session.last_active,
            };
          })
        )
      ).filter(Boolean);
    } catch (err: any) {
      console.error("[TUTOR] FETCH FAILED:", err.message);
    }

    return [...giniQueries, ...tutorQueries]
      .sort((a: any, b: any) => (parseMySQLDate(b.created_at) as any) - (parseMySQLDate(a.created_at) as any))
      .slice(0, limit)
      .map(({ created_at, ...rest }) => rest);
  }

  async getFeaturesExplored(user_id: number): Promise<any[]> {
    const { giniCount, giniLast, practiceCount, practiceLast, aiNotesCount, aiNotesLast, summaryCount, summaryLast } =
      await historyRepository.getFeaturesData(user_id);

    let tutorCount = 0, tutorLastDate: any = null;
    try {
      const tutor = await historyRepository.getTutorFeatureData(user_id, TUTOR_USER_MATCH);
      tutorCount    = tutor.tutorCount;
      tutorLastDate = tutor.tutorLastDate;
    } catch (err: any) {
      console.error(`[getFeaturesExplored] tutor failed:`, err.message);
    }

    return [
      { feature: "AI Gini",        uses: giniCount,     last_used: getCreatedAt(giniLast)     ? relativeTime(getCreatedAt(giniLast))     : "Never" },
      { feature: "AI Tutor",       uses: tutorCount,    last_used: tutorLastDate               ? relativeTime(tutorLastDate)              : "Never" },
      { feature: "AI Notes",       uses: aiNotesCount,  last_used: getCreatedAt(aiNotesLast)  ? relativeTime(getCreatedAt(aiNotesLast))  : "Never" },
      { feature: "AI Practice",    uses: practiceCount, last_used: getCreatedAt(practiceLast) ? relativeTime(getCreatedAt(practiceLast)) : "Never" },
      { feature: "Doc Summariser", uses: summaryCount,  last_used: getCreatedAt(summaryLast)  ? relativeTime(getCreatedAt(summaryLast))  : "Never" },
    ];
  }

  async getLoginHistory(user_id: number, limit: number): Promise<any[]> {
    const sessions = await historyRepository.getLoginSessions(user_id, limit);

    return sessions.map((s: any) => ({
      session_id: s.session_id,
      date:       new Date(s.login_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" }),
      time:       new Date(s.login_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
      device:     s.device || "Desktop",
      location:   s.city && s.country ? `${s.city}, ${s.country}` : s.ip_address || "Unknown",
      logout_at:  s.logout_at,
    }));
  }

  async getWeekActivity(user_id: number): Promise<{ days: any[]; total_active: number }> {
    const now       = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const sessions = await historyRepository.getWeekSessions(user_id, weekStart, weekEnd);
    const activeDays = new Set(sessions.map((s: any) => new Date(s.login_at).getDay()));

    const days = ["S", "M", "T", "W", "T", "F", "S"].map((label, idx) => ({
      label, active: activeDays.has(idx),
    }));

    return { days, total_active: activeDays.size };
  }

  async getStats(user_id: number): Promise<{ login_days: number; test_overall: number; current_streak: number; longest_streak: number }> {
    const [loginDays, testOverall] = await Promise.all([
      historyRepository.getLoginDays(user_id),
      historyRepository.getStudentAnalyticsScore(user_id),
    ]);

    let current_streak = 0, longest_streak = 0;
    try {
      const streakRow = await historyRepository.findStreak(user_id);
      current_streak = (streakRow as any)?.current_streak || 0;
      longest_streak = (streakRow as any)?.longest_streak || 0;
    } catch (err: any) {
      console.error("[getStats] streak fetch failed:", err.message);
    }

    return { login_days: loginDays, test_overall: testOverall, current_streak, longest_streak };
  }

  async getConversation(user_id: number, conversation_id: string, source: string): Promise<any> {
    if (!conversation_id) throw new ApiError(400, "conversation_id required");

    if (source === "gini") {
      const allRows = await historyRepository.getGiniConversationFull(conversation_id, user_id);
      if (!allRows.length) throw new ApiError(404, "Conversation not found");

      const messages: any[] = [];
      for (const row of allRows as any[]) {
        try {
          const userMsg = JSON.parse(row.messages || "{}");
          if (userMsg?.content !== undefined) messages.push({ role: "user", content: userMsg.content });
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

      const firstRow  = (allRows as any[])[0];
      const lastRow   = (allRows as any[])[allRows.length - 1];
      const firstUser = messages.find((m) => m.role === "user");
      const title     = firstUser?.content?.slice(0, 100) || firstRow?.subject || "AI Gini conversation";

      return {
        conversation_id,
        source: "AI Gini", redirect_to: "/ai-gini",
        title,
        subject:    firstRow.subject  || null,
        class:      firstRow.class    || null,
        language:   firstRow.language || null,
        messages,
        turn_count: messages.filter((m) => m.role === "user").length,
        started_at: firstRow.created_at,
        updated_at: lastRow.created_at,
      };
    }

    if (source === "tutor") {
      const allRows = await historyRepository.getTutorConversationFull(conversation_id, user_id, TUTOR_USER_MATCH);
      if (!allRows.length) throw new ApiError(404, "Conversation not found");

      const messages = buildTutorMessages(allRows);
      const title    = extractTutorTitleFromRows(allRows) || "AI Tutor conversation";

      return {
        conversation_id,
        source: "AI Tutor", redirect_to: "/ai-tutor",
        title,
        messages,
        turn_count: messages.filter((m) => m.role === "user").length,
        started_at: (allRows as any[])[0].created_at,
        updated_at: (allRows as any[])[allRows.length - 1].created_at,
      };
    }

    if (source === "practice") {
      const rows = await historyRepository.getPracticeConversationFull(conversation_id, user_id);
      if (!rows.length) throw new ApiError(404, "Conversation not found");

      const last  = rows[rows.length - 1];
      const title = extractTitle((last as any).request_body) || "Practice session";

      const messages = rows.flatMap((r: any) => {
        const req_body = typeof r.request_body  === "string" ? JSON.parse(r.request_body  || "{}") : (r.request_body  || {});
        const res_body = typeof r.response_body === "string" ? JSON.parse(r.response_body || "{}") : (r.response_body || {});
        const out: any[] = [];
        if (Array.isArray(req_body))               out.push(...req_body);
        else if (Array.isArray(req_body.messages)) out.push(...req_body.messages);
        else if (req_body.question || req_body.prompt)
          out.push({ role: "user", content: req_body.question || req_body.prompt });
        const answer = res_body.answer || res_body.response || res_body.content || res_body.text;
        if (answer) out.push({ role: "assistant", content: answer });
        return out;
      });

      return {
        conversation_id,
        source: "AI Practice", redirect_to: "/ai-practice",
        title, messages,
        turn_count: messages.filter((m: any) => m.role === "user").length,
        started_at: (rows[0] as any).created_at,
        updated_at: (last as any).created_at,
      };
    }

    throw new ApiError(400, `Unknown source "${source}". Use gini, tutor, or practice.`);
  }

  async getLatestTests(user_id: number): Promise<any[]> {
    return historyRepository.getLatestTests(user_id);
  }
}

export const historyService = new HistoryService();