import { describe, it, vi, expect } from "vitest";

import { appFeedbackController } from "../src/ai-features/app_feedback/appFeedbackController.js";
import { appFeedbackService } from "../src/ai-features/app_feedback/appFeedbackService.js";

vi.mock("../src/ai-features/app_feedback/appFeedbackService.js", () => ({
  appFeedbackService: vi.fn(),
}));

describe("App feedback controller testing", async () => {
  it("should return 201 when valid input is provided", async () => {
    const req = {
      body: {
        name: "John",
        email: "john@test.com",
        subject: "Test",
        message: "Hello",
      },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      json: vi.fn(),
    };

    await appFeedbackController(req, res);

    expect(appFeedbackService).toHaveBeenCalledWith({
      name: "John",
      email: "john@test.com",
      subject: "Test",
      message: "Hello",
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalled();
  });

  it("should return 400 if fields are missing", async () => {
    const req = {
      body: {
        name: "",
        email: "",
        subject: "",
        message: "",
      },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await appFeedbackController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "All fields are required",
    });
  });

  it("should return 400 for invalid email", async () => {
    const req = {
      body: {
        name: "John",
        email: "invalid-email",
        subject: "Test",
        message: "Hello",
      },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await appFeedbackController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid email",
    });
  });

  it("should return 500 when service throws error", async () => {
    const req = {
      body: {
        name: "John",
        email: "john@test.com",
        subject: "Test",
        message: "Hello",
      },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
    };

    appFeedbackService.mockRejectedValue();

    await appFeedbackController(req, res);

    expect(appFeedbackService).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(500);

    expect(res.json).toHaveBeenCalledWith({
      message: "Something went wrong",
    });
  });
});
