import { describe, it, expect, vi, beforeEach } from "vitest";
// import dotenv from "dotenv";
// console.log("env => ", process.cwd() + "/config.env");

// dotenv.config({ path: process.cwd() + "/config.env" });

import {
  getSchema,
  mcqSchema,
  saAndLaSchema,
  generatePracticeQuestions,
} from "../src/ai-features/gini/practiceQuestions/generatePracticeQuestions";

describe("getOpenAIClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("creates OpenAI client only once", async () => {
    const { getOpenAIClient } =
      await import("../src/ai-features/gini/practiceQuestions/generatePracticeQuestions");

    const client1 = getOpenAIClient();
    const client2 = getOpenAIClient();

    // expect(OpenAI).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
  });
});

it("returns MCQ schema", () => {
  expect(getSchema("MCQ")).toBe(mcqSchema);
});

it("returns SA/LA schema for other types", () => {
  expect(getSchema("SA")).toBe(saAndLaSchema);
});

vi.mock("openai", () => {
  const mockParse = vi.fn().mockResolvedValue({
    output_parsed: {
      questions: [{ question: "Mock question?", answer: "Mock answer" }],
    },
  });

  class MockOpenAI {
    responses: object;
    constructor() {
      this.responses = {
        parse: mockParse,
      };
    }
  }

  return {
    default: MockOpenAI,
  };
});

it("generatePracticeQuestions", async () => {
  const resutl = await generatePracticeQuestions(
    "10th",
    "english",
    "scince",
    "2",
    "MCQ",
    "2",
  );

  expect(resutl).toStrictEqual([
    { question: "Mock question?", answer: "Mock answer" },
  ]);
});
