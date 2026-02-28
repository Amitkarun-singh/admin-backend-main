import dotenv from "dotenv";
dotenv.config();
import { parseMCQs } from "../../util/parceMCQ.js";
import { parseQnA } from "../../util/parceQnA.js";
import { getPYQ } from "../../modal/questions.modal.js";

import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const generatePracticeQuestions = async (
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
) => {
  if (questionType === "PYQ") {
    return await PYQ(class_, language, subject, chapter);
  }

  if (questionType === "PQ") {
    return await PQ(class_, language, subject, chapter);
  }

  return await dynamicQnA(
    class_,
    language,
    subject,
    chapter,
    questionType,
    count,
  );
};

const dynamicQnA = async (
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
) => {
  // console.log(questionType, count);

  const getQueationPromp = (qt) => {
    switch (qt) {
      case qt == "MCQ":
        return `-  MCQ, provide ${count} multiple choice questions with 4 options each and indicate the correct answer.`;
      case qt == "SA":
        return ` -  Short Answer, provide ${count} questions that can be answered in 2-3 lines.`;
      case qt == "LA":
        return `-  is Long Answer, provide ${count} questions that require detailed answers.`;
    }
  };
  try {
    const prompt = `
      You are an expert educator. Generate **${count} ${questionType} question${count > 1 ? "s" : ""}**
      for students studying in ${class_}, subject ${subject}, chapter "${chapter}".
      Response should be in ${language}.

      Instructions:
       ${getQueationPromp(questionType)}
      

      Provide the questions clearly, numbered, and in an easy-to-read format.
    `;

    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [{ role: "user", content: prompt }],

      max_tokens: 1500,
    });

    const content = completion.choices[0].message.content;

    if (questionType === "MCQ") {
      return parseMCQs(content);
    }
    return parseQnA(content);
  } catch (error) {
    console.error(`Error generating ${questionType} questions:`, error);
    return `Failed to generate ${questionType} questions. Please try again.`;
  }
};

const PYQ = async (class_, language, subject, chapter) => {
  const questions = await getPYQ([class_, language, subject, chapter]);
  return questions;
};

const PQ = async (class_, language, subject, chapter) => {
  const questions = await getPYQ([class_, language, subject, chapter]);
  return questions;
};

export { generatePracticeQuestions };
