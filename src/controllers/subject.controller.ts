import { Request, Response } from "express";
import { subjectService } from "../services/subject.service.ts";

export const addSubjectsWithChapters = async (req: Request, res: Response): Promise<void> => {
  try {
    const { class_id, board, language, subjects } = req.body;
    await subjectService.addSubjectsWithChapters({ class_id, board, language, subjects });
    res.status(201).json({ success: true, message: "Subjects and Chapters added successfully" });
  } catch (error: any) {
    res.status(error.status === 404 ? 404 : 400).json({ success: false, message: error.message });
  }
};

export const getSubjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { class_id, board, language } = req.query;
    const user_id = (req as any).user.user_id;

    const result = await subjectService.getSubjects({
      class_id: class_id as string | undefined,
      board:    board    as string | undefined,
      language: language as string | undefined,
      user_id,
    });

    res.status(200).json({ success: true, resolved: result.resolved, data: result.subjects });
  } catch (error: any) {
    const status = error.message === "User not found" ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const getChapters = async (req: Request, res: Response): Promise<void> => {
  try {
    const { class_id, subject_id } = req.params;
    const chapters = await subjectService.getChapters(class_id, subject_id);
    res.status(200).json({ success: true, data: chapters });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubjectName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject_id } = req.params;
    const { subject_name } = req.body;
    await subjectService.updateSubjectName(subject_id, subject_name);
    res.status(200).json({ success: true, message: "Subject updated successfully" });
  } catch (error: any) {
    const status = error.message === "Subject not found" ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject_id } = req.params;
    await subjectService.deleteSubject(subject_id);
    res.status(200).json({ success: true, message: "Subject deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addChaptersToSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject_id } = req.params;
    const { chapters } = req.body;
    await subjectService.addChaptersToSubject(subject_id, chapters);
    res.status(201).json({ success: true, message: "Chapters added successfully" });
  } catch (error: any) {
    const status = error.message === "Subject not found" || error.message === "Class not found" ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const updateChapter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chapter_id } = req.params;
    const { chapter_name } = req.body;
    await subjectService.updateChapter(chapter_id, chapter_name);
    res.status(200).json({ success: true, message: "Chapter updated successfully" });
  } catch (error: any) {
    const status = error.message === "Chapter not found" ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const deleteChapter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chapter_id } = req.params;
    await subjectService.deleteChapter(chapter_id);
    res.status(200).json({ success: true, message: "Chapter deleted successfully" });
  } catch (error: any) {
    const status = error.message === "Chapter not found" ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};