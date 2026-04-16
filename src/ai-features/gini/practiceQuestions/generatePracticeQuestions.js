import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

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

let _openai = null;

export function getOpenAIClient() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export const generatePracticeQuestions = async (
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
) => {
  try {
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

    return content.questions;
  } catch (error) {
    console.error(`Error generating ${questionType} questions:`, error);
    return `Failed to generate ${questionType} questions. Please try again.`;
  }
};

function getprompt({
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
}) {
  return `
      You are an expert educator. Generate **${count} ${questionType} question${count > 1 ? "s" : ""}**
      for students studying in ${class_}, subject ${subject}, chapter "${chapter}".
      Response should be in ${language}.

      Instructions:
       ${getQuestionPrompt(questionType, count)}
      

      Provide the questions clearly, numbered, and in an easy-to-read format.

    `;
}

function getQuestionPrompt(questionType, count) {
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

export function getSchema(questionType) {
  return questionType === "MCQ" ? mcqSchema : saAndLaSchema;
}

export const submitAnswer = async (questionId, testId, answer) => {
  await insertAnswer([questionId, testId, answer]);
};

export const testResult = (testId) => {
  const result = fetchTestResultById(testId);
  return result;
};
