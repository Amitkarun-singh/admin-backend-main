import sequelize from "../config/db.js";
import { subjectRepository } from "../repositories/subject.repository.js";
import AdminSubject from "../models/admin_subject_master.model.js";
import AdminChapterMaster from "../models/admin_chapter_master.model.js";

interface SubjectWithChapters {
  subject_name: string;
  chapters: string[];
}

interface AddSubjectsInput {
  class_id: number;
  board: string;
  language: string;
  subjects: SubjectWithChapters[];
}

interface GetSubjectsInput {
  class_id?: string | number;
  board?: string;
  language?: string;
  user_id: number | string;
}

interface GetSubjectsResult {
  resolved: { class_id?: string | number; board?: string; language?: string };
  subjects: AdminSubject[];
}

export class SubjectService {

  async addSubjectsWithChapters(input: AddSubjectsInput): Promise<void> {
    const { class_id, board, language, subjects } = input;

    if (!class_id || !board || !language || !subjects?.length) {
      throw new Error("class_id, board, language and subjects required");
    }

    const classData = await subjectRepository.findClassById(class_id);
    if (!classData) throw new Error("Class not found");

    const transaction = await sequelize.transaction();

    try {
      for (const subjectData of subjects) {
        const { subject_name, chapters } = subjectData;

        if (!subject_name || !chapters?.length) {
          throw new Error("Each subject must have subject_name and chapters");
        }

        let subject = await subjectRepository.findSubjectByUnique({ class_id, board, language, subject_name });

        if (!subject) {
          subject = await subjectRepository.createSubject({ class_id, board, language, subject_name }, transaction);
        }

        const chapterPayload = chapters.map((chapterName, index) => ({
          subject_id:    (subject as any).subject_id,
          class_id,
          board_name:    board,
          language,
          chapter_name:  chapterName,
          chapter_order: index + 1,
          status:        "active",
        }));

        await subjectRepository.bulkCreateChapters(chapterPayload, transaction);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getSubjects(input: GetSubjectsInput): Promise<GetSubjectsResult> {
    let { class_id, board, language, user_id } = input;

    if (!class_id || !board || !language) {
      const user = await subjectRepository.findUserById(user_id);
      if (!user) throw new Error("User not found");

      if (!board && (user as any).school_id) {
        const school = await subjectRepository.findSchoolById((user as any).school_id);
        if (school) board = (school as any).board;
      }

      const studentProfile = await subjectRepository.findStudentProfile(user_id);

      if (!language && studentProfile?.preferred_language) {
        language = studentProfile.preferred_language;
      }

      if (!class_id && studentProfile?.student_id) {
        const classSection = await subjectRepository.findStudentClassSection(studentProfile.student_id);
        if (classSection) class_id = (classSection as any).class_id;
      }
    }

    const where: Record<string, any> = {};
    if (class_id) where.class_id = class_id;
    if (board)    where.board    = board;
    if (language) where.language = language;

    if (Object.keys(where).length === 0) {
      throw new Error("Could not resolve class, board or language. Please provide them explicitly.");
    }

    const subjects = await subjectRepository.findAllSubjects(where);
    return { resolved: { class_id, board, language }, subjects };
  }

  async getChapters(class_id: number | string, subject_id: number | string): Promise<AdminChapterMaster[]> {
    return subjectRepository.findChaptersByClassAndSubject(class_id, subject_id);
  }

  async updateSubjectName(subject_id: number | string, subject_name: string): Promise<AdminSubject> {
    if (!subject_name) throw new Error("subject_name is required");

    const subject = await subjectRepository.findSubjectById(subject_id);
    if (!subject) throw new Error("Subject not found");

    (subject as any).subject_name = subject_name;
    await (subject as any).save();
    return subject;
  }

  async deleteSubject(subject_id: number | string): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      await subjectRepository.deleteChaptersBySubject(subject_id, transaction);
      await subjectRepository.deleteSubjectById(subject_id, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async addChaptersToSubject(
    subject_id: number | string,
    chapters: string[]
  ): Promise<void> {
    if (!chapters?.length) throw new Error("chapters array required");

    const subject = await subjectRepository.findSubjectById(subject_id);
    if (!subject) throw new Error("Subject not found");

    const classData = await subjectRepository.findClassById((subject as any).class_id);
    if (!classData) throw new Error("Class not found");

    const existingChapters = await subjectRepository.findExistingChapters(subject_id);
    const existingNames = existingChapters.map((c) => (c as any).chapter_name);

    const payload = chapters
      .filter((name) => !existingNames.includes(name))
      .map((name, index) => ({
        subject_id,
        class_id:      (subject as any).class_id,
        board_name:    (subject as any).board,
        language:      (subject as any).language,
        chapter_name:  name.trim(),
        chapter_order: index + 1,
        status:        "active",
      }));

    await subjectRepository.bulkCreateChapters(payload);
  }

  async updateChapter(chapter_id: number | string, chapter_name: string): Promise<AdminChapterMaster> {
    const chapter = await subjectRepository.findChapterById(chapter_id);
    if (!chapter) throw new Error("Chapter not found");

    (chapter as any).chapter_name = chapter_name;
    await (chapter as any).save();
    return chapter;
  }

  async deleteChapter(chapter_id: number | string): Promise<void> {
    const deleted = await subjectRepository.deleteChapterById(chapter_id);
    if (!deleted) throw new Error("Chapter not found");
  }
}

export const subjectService = new SubjectService();