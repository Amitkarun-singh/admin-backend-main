import { Op } from "sequelize";
import sequelize from "../config/db.js";

import GiniLog          from "../models/gini_log.model.js";
import TutorLog         from "../models/Tutor_log.model.js";
import PracticeLog      from "../models/practice_log.model.js";
import AiUsageLog       from "../models/ai_usage_log.model.js";
import UserSession      from "../models/user_session.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import StudentProfile   from "../models/student_profile.model.js";
import UserStreak       from "../models/user_streak.model.js";

export class HistoryRepository {

  async createSession(data: {
    user_id: number;
    login_at: Date;
    device: string;
    ip_address: string | null;
  }): Promise<UserSession> {
    return UserSession.create(data);
  }

  async findOpenSession(user_id: number): Promise<UserSession | null> {
    return UserSession.findOne({
      where: { user_id, logout_at: null },
      order: [["login_at", "DESC"]],
    });
  }

  async findStreak(user_id: number): Promise<UserStreak | null> {
    return UserStreak.findOne({ where: { user_id } });
  }

  async createStreak(data: Record<string, any>): Promise<UserStreak> {
    return UserStreak.create(data);
  }

  async updateStreak(streak: UserStreak, data: Record<string, any>): Promise<UserStreak> {
    return streak.update(data);
  }

  async getGiniConversations(user_id: number, limit: number): Promise<any[]> {
    return GiniLog.findAll({
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
  }

  async getGiniConversationRow(conversation_id: string, user_id: number): Promise<any[]> {
    return sequelize.query(
      `SELECT messages, subject, \`class\`
       FROM chatbot_logs
       WHERE conversation_id = :cid AND user_id = :uid
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      { replacements: { cid: conversation_id, uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
  }

  async getTutorSessions(user_id: number, limit: number, tutorUserMatch: string): Promise<any[]> {
    return sequelize.query(
      `SELECT session_id, MAX(created_at) AS last_active, COUNT(id) AS turn_count
       FROM tutor_logs
       WHERE ${tutorUserMatch} AND session_id IS NOT NULL AND session_id != ''
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT :lim`,
      { replacements: { uid: user_id, lim: limit }, type: sequelize.QueryTypes.SELECT }
    );
  }

  async getTutorSessionTitleRow(session_id: string, user_id: number, tutorUserMatch: string): Promise<any[]> {
    return sequelize.query(
      `SELECT request_body, response_body
       FROM tutor_logs
       WHERE session_id = :sid AND ${tutorUserMatch}
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      { replacements: { sid: session_id, uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
  }

  async getGiniConversationFull(conversation_id: string, user_id: number): Promise<any[]> {
    return sequelize.query(
      `SELECT messages, response_body, subject, \`class\`, language, created_at
       FROM   chatbot_logs
       WHERE  conversation_id = :cid AND user_id = :uid
       ORDER  BY created_at ASC`,
      { replacements: { cid: conversation_id, uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
  }

  async getTutorConversationFull(conversation_id: string, user_id: number, tutorUserMatch: string): Promise<any[]> {
    return sequelize.query(
      `SELECT id, request_body, response_body, created_at
       FROM   tutor_logs
       WHERE  session_id = :sid AND ${tutorUserMatch}
       ORDER  BY created_at ASC, id ASC`,
      { replacements: { sid: conversation_id, uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
  }

  async getPracticeConversationFull(conversation_id: string, user_id: number): Promise<PracticeLog[]> {
    return PracticeLog.findAll({
      where: { conversation_id, user_id },
      order: [["created_at", "ASC"]],
      attributes: ["id", "conversation_id", "request_body", "response_body", "device", "created_at"],
    });
  }

  async getFeaturesData(user_id: number): Promise<{
    giniCount: number;
    giniLast: GiniLog | null;
    practiceCount: number;
    practiceLast: PracticeLog | null;
    aiNotesCount: number;
    aiNotesLast: AiUsageLog | null;
    summaryCount: number;
    summaryLast: AiUsageLog | null;
  }> {
    const aiNotesWhere = {
      user_id, feature: "ai_notes",
      [Op.or]: [{ endpoint: { [Op.notLike]: "/api/ainote/%" } }, { endpoint: null }],
    };

    const [giniCount, giniLast, practiceCount, practiceLast, aiNotesCount, aiNotesLast, summaryCount, summaryLast] =
      await Promise.all([
        GiniLog.count({ where: { user_id } }),
        GiniLog.findOne({ where: { user_id }, order: [["created_at", "DESC"]], attributes: ["created_at"] }),
        PracticeLog.count({ where: { user_id } }),
        PracticeLog.findOne({ where: { user_id }, order: [["created_at", "DESC"]] }),
        AiUsageLog.count({ where: aiNotesWhere }),
        AiUsageLog.findOne({ where: aiNotesWhere, order: [["created_at", "DESC"]] }),
        AiUsageLog.count({ where: { user_id, feature: "summarizer" } }),
        AiUsageLog.findOne({ where: { user_id, feature: "summarizer" }, order: [["created_at", "DESC"]] }),
      ]);

    return { giniCount, giniLast, practiceCount, practiceLast, aiNotesCount, aiNotesLast, summaryCount, summaryLast };
  }

  async getTutorFeatureData(user_id: number, tutorUserMatch: string): Promise<{ tutorCount: number; tutorLastDate: any }> {
    const [countRow]: any[] = await sequelize.query(
      `SELECT COUNT(DISTINCT session_id) AS cnt FROM tutor_logs
       WHERE ${tutorUserMatch} AND session_id IS NOT NULL AND session_id != ''`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    const [lastRow]: any[] = await sequelize.query(
      `SELECT created_at FROM tutor_logs WHERE ${tutorUserMatch} ORDER BY created_at DESC LIMIT 1`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    return {
      tutorCount:    parseInt(countRow?.cnt) || 0,
      tutorLastDate: lastRow?.created_at     || null,
    };
  }

  async getLoginSessions(user_id: number, limit: number): Promise<UserSession[]> {
    return UserSession.findAll({
      where: { user_id },
      order: [["login_at", "DESC"]],
      limit,
      attributes: ["session_id", "login_at", "logout_at", "device", "ip_address", "city", "country"],
    });
  }

  async getWeekSessions(user_id: number, weekStart: Date, weekEnd: Date): Promise<any[]> {
    return UserSession.findAll({
      where: { user_id, login_at: { [Op.between]: [weekStart, weekEnd] } },
      attributes: ["login_at"],
      raw: true,
    });
  }

  async getLoginDays(user_id: number): Promise<number> {
    const result: any[] = await sequelize.query(
      `SELECT COUNT(DISTINCT DATE(login_at)) AS cnt FROM user_sessions WHERE user_id = :user_id`,
      { replacements: { user_id }, type: sequelize.QueryTypes.SELECT }
    );
    return parseInt(result[0]?.cnt) || 0;
  }

  async getStudentAnalyticsScore(user_id: number): Promise<number> {
    try {
      const student = await StudentProfile.findOne({ where: { user_id } });
      if (!student) return 0;
      const analytics = await StudentAnalytics.findOne({ where: { student_id: (student as any).student_id } });
      return analytics ? parseFloat((analytics as any).ai_practice_score) || 0 : 0;
    } catch { return 0; }
  }

  async getLatestTests(student_id: number): Promise<any[]> {
    return sequelize.query(
      `SELECT pt.subject, ROUND(AVG(pq.is_correct) * 100) AS score
       FROM practice_tests pt
       JOIN practice_questions pq ON pt.id = pq.test_id
       WHERE pt.student_id = :student_id
       GROUP BY pt.id
       ORDER BY pt.created_at DESC`,
      { replacements: { student_id }, type: sequelize.QueryTypes.SELECT }
    );
  }
}

export const historyRepository = new HistoryRepository();