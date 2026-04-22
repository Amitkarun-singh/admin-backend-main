import {
  generatePracticeQuestions,
  submitAnswer,
  testResult,
} from "./generatePracticeQuestions.js";
import { insertTest, insertQuestions } from "../../modal/questions.modal.js";
import type { Request, Response } from "express";
import { number, string } from "zod";

export const generatePracticeQuestionsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { subject, chapter, questionType, class_, language, questionsCount } =
      req.body;

    if (!subject || !chapter || !questionType || !questionsCount) {
      return res.status(400).json({
        error:
          "Please provide 'subject', 'chapter', 'questionType', and 'questionsCount' in the request body.",
      });
    }

    type QuestionType = "MCQ" | "SA" | "LA";

    interface Question {
      id: string;
      question: string; // Changed from 'text' to 'question' to match Zod
      options?: string[];
      answer: string;
      answer_explanation?: string;
      marks?: number;
    }
    type QuestionsMap = Record<QuestionType, Question[]>;
    const allQuestions = {} as QuestionsMap;

    await Promise.all(
      questionType.map(async (type: QuestionType) => {
        const count = questionsCount[type.toLowerCase()] || 1;
        allQuestions[type] = await generatePracticeQuestions({
          class_,
          language,
          subject,
          chapter,
          questionType: type,
          count,
        });
      }),
    );

    let testId;
    const studentId = req.user.user_id;
    console.log("user details", req.user.user_id);

    testId = await insertTest([
      class_,
      subject,
      chapter.toString(),
      language,
      studentId,
    ]);
    await insertQuestions(testId, allQuestions);

    res.status(200).json({
      testId,
      subject,
      chapter,
      questionType,
      questions: allQuestions,
      message: "AI-generated practice questions successfully created.",
    });

    // res.status(200).json({ ...examData });
  } catch (error) {
    console.error("Error in /generate-practice-questions endpoint:", error);
    res.status(500).json({
      error: "Failed to generate practice questions. Please try again later.",
    });
  }
};

export const submitAnswerController = async (req: Request, res: Response) => {
  try {
    const { questionId, testId, answer } = req.body;
    await submitAnswer(questionId, testId, answer);
    res.status(200).json({ isSuccessful: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to save answer.",
      isSuccessful: false,
    });
  }
};

export const testResultController = async (req: Request, res: Response) => {
  const testId = Number(req.params.testId);

  try {
    const result = await testResult(testId);
    res.status(200).json({ isSuccessful: true, result });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch result.",
      isSuccessful: false,
    });
  }
};
