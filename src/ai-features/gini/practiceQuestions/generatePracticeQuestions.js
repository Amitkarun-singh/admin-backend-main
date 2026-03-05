import dotenv from "dotenv";
dotenv.config();
import { parseMCQs } from "../../util/parceMCQ.js";
import { parseQnA } from "../../util/parceQnA.js";
import { getPYQ } from "../../modal/questions.modal.js";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { errorMessage } from "../../../../error.js";

import OpenAI from "openai";

let openai;

try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch {
  errorMessage.push("API_KEY OPENAI_API_KEY required");
}
const mcqSchema = z
  .object({
    questions: z.array(
      z
        .object({
          question: z.string(),
          options: z.array(z.string()).min(4).max(4),
        })
        .strict(), // = additionalProperties: false
    ),
  })
  .strict();

const saAndLaSchema = z
  .object({
    questions: z.array(
      z
        .object({
          question: z.string(),
        })
        .strict(), // prevents extra fields (additionalProperties: false)
    ),
  })
  .strict(); // prevents extra root-level fields
const generatePracticeQuestions = async (
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
) => {
  const schema = questionType === "MCQ" ? mcqSchema : saAndLaSchema;
  return await dynamicQnA(
    class_,
    language,
    subject,
    chapter,
    questionType,
    count,
    schema,
  );
};

const dynamicQnA = async (
  class_,
  language,
  subject,
  chapter,
  questionType,
  count,
  schema,
) => {
  console.log(questionType, count);

  const getQueationPromp = (qt) => {
    switch (qt) {
      case qt == "MCQ":
        return `-  provide ${count} multiple choice questions with 4 options each and indicate the correct answer.`;
      case qt == "SA":
        return ` -   provide ${count} questions that can be answered in 2-3 lines.`;
      case qt == "LA":
        return `-   provide ${count} questions that require detailed answers.`;
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

    const response = await openai.responses.parse({
      model: "gpt-4o-mini",
      input: [{ role: "user", content: prompt }],
      text: {
        format: zodTextFormat(schema, "event"),
      },
    });

    const content = response.output_parsed;
    // console.log(content.questions);

    return content.questions;
  } catch (error) {
    console.error(`Error generating ${questionType} questions:`, error);
    return `Failed to generate ${questionType} questions. Please try again.`;
  }
};

export { generatePracticeQuestions };
