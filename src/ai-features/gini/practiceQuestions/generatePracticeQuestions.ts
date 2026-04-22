import { zodTextFormat } from "openai/helpers/zod";
import { number, z } from "zod";

import {
  insertAnswer,
  fetchTestResultById,
} from "../../modal/questions.modal.js";

import OpenAI from "openai";

export const mcqSchema = z
  .object({
    questions: z.array(
      z
        .object({
          id: z.uuid(),
          question: z.string(),
          options: z.array(z.string()).min(4).max(4),
          answer: z.string(),
          answer_explanation: z.string(),
          marks: z.number(),
        })
        .strict(), // = additionalProperties: false
    ),
  })
  .strict();

export const saAndLaSchema = z
  .object({
    questions: z.array(
      z
        .object({
          id: z.uuid(),
          question: z.string(),
          answer: z.string(),
        })
        .strict(), // prevents extra fields (additionalProperties: false)
    ),
  })
  .strict();

let _openai: OpenAI | null = null;

export function getOpenAIClient() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
interface Question {
  id: string;
  question: string; // Changed from 'text' to 'question' to match Zod
  options?: string[];
  answer: string;
  answer_explanation?: string;
  marks?: number;
}
type QuestionType = "MCQ" | "SA" | "LA";
interface PracticeRequest {
  class_: string; // Using class_ to avoid the reserved 'class' keyword
  language: string;
  subject: string;
  chapter: string;
  questionType: QuestionType; // Array since you are mapping over it
  count: number; // Optional if you have a default
}
export const generatePracticeQuestions = async ({
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
}: PracticeRequest): Promise<Question[]> => {
  const openai = getOpenAIClient();
  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: getprompt({
          class_,
          language,
          subject,
          chapter,
          questionType,
          count,
        }),
      },
    ],
    text: {
      format: zodTextFormat(getSchema(questionType), "event"),
    },
  });

  const content = response.output_parsed;

  return content?.questions || [];
};

function getprompt({
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
}: PracticeRequest): string {
  return `
      You are an expert educator. Generate **${count} ${questionType} question${count > 1 ? "s" : ""}**
      for students studying in ${class_}, subject ${subject}, chapter "${chapter}".
      Response should be in ${language}.

      Instructions:
       ${getQuestionPrompt(questionType, count)}
      

      Provide the questions clearly, numbered, and in an easy-to-read format.

    `;
}

function getQuestionPrompt(
  questionType: QuestionType,
  count: number | undefined,
) {
  switch (questionType) {
    case "MCQ":
      return `Provide ${count} multiple choice questions with 4 options each, indicate the correct answer, and assign 1 mark each.`;
    case "SA":
      return `Provide ${count} short-answer questions that can be answered in 2-3 lines.`;
    case "LA":
      return `Provide ${count} long-answer questions that require detailed answers.`;
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

export function getSchema(questionType: QuestionType) {
  return questionType === "MCQ" ? mcqSchema : saAndLaSchema;
}

export const submitAnswer = async (
  questionId: number,
  testId: number,
  answer: string,
) => {
  await insertAnswer([questionId, testId, answer]);
};

export const testResult = (testId: number) => {
  const result = fetchTestResultById(testId);
  return result;
};
