import {
  generatePracticeQuestions,
  submitAnswer,
  testResult,
} from "./generatePracticeQuestions.js";
import { insertTest, insertQuestions } from "../../modal/questions.modal.js";

export const generatePracticeQuestionsController = async (req, res) => {
  try {
    const { subject, chapter, questionType, class_, language, questionsCount } =
      req.body;

    if (!subject || !chapter || !questionType || !questionsCount) {
      return res.status(400).json({
        error:
          "Please provide 'subject', 'chapter', 'questionType', and 'questionsCount' in the request body.",
      });
    }

    const allQuestions = {};

    await Promise.all(
      questionType.map(async (type) => {
        const count = questionsCount[type.toLowerCase()] || 1;
        allQuestions[type] = await generatePracticeQuestions(
          class_,
          language,
          subject,
          chapter,
          type,
          count,
        );
      }),
    );

    let testId;
    const studentId = req.user.user_id;
    console.log("user details", req.user.user_id);
    try {
      testId = await insertTest([
        class_,
        subject,
        chapter,
        language,
        studentId,
      ]);
      await insertQuestions(testId, allQuestions);
      console.log("Test and questions inserted successfully!");
    } catch (err) {
      console.error(err);
    }

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

export const submitAnswerController = async (req, res) => {
  try {
    const { questionId, testId, answer } = req.body;
    await submitAnswer(questionId, testId, answer);
    res.status(200).json({ isSuccessful: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: "Failed to save answer.",
      isSuccessful: false,
    });
  }
};

export const testResultController = async (req, res) => {
  const { testId } = req.params;

  const result = await testResult(testId);
  res.status(200).json({ isSuccessful: true, result });
  try {
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch result.",
      isSuccessful: false,
    });
  }
};
