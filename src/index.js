// ─── Global BigInt serializer (must be before any imports that use BigInt) ───
// Express's res.json() uses JSON.stringify internally, which cannot handle
// native BigInt. This patch converts BigInt to a Number-safe string globally.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// 🚨 dotenv MUST be first
import "./bootstrap.js";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import sequelize from "./config/db.js";
import "./models/index.js";
import authRoutes from "./routes/V1/auth.routes.js";
import adminRoutes from "./routes/V1/admin.routes.ts";
import classRoutes from "./routes/V1/class.routes.js";
import sectionRoutes from "./routes/V1/section.routes.js";
import subjectRoutes from "./routes/V1/subject.routes.js";
import courseRoutes from "./routes/V1/course.routes.js";
import teacherRoutes from "./routes/V1/teacher.routes.js";
import studentRoutes from "./routes/V1/student.routes.js";
import parentRoutes from "./routes/V1/parent.routes.js";
import registerRoutes from "./routes/V1/register.routes.js";

import historyRoutes from "./routes/V1/history.routes.js";
import { globalErrorHandler } from "./error/globalErrorHandler.ts";
import { traceMiddleware } from "./middlewares/traceMiddleware,meiddleware.ts";

// Imports for AI features
import giniRouter from "./routes/V1/giniRouter.routes.ts";
import performanceRouter from "./routes/V1/studentPerformance.Router.js";
import previousPapersRouter from "./routes/V1/previousPapers.router.js";
import predictPapersRouter from "./routes/V1/predictPapers.router.ts";
import summarizeRoute from "./routes/V1/summarize.routes.js";
import ainoteRoute from "./routes/V1/ainote.routes.js";
import assessmentRoutes from "./routes/V1/assessment.routes.js";
import appFeedbackRouter from "./routes/V1/appFeedback.route.ts";
import featureRoutes from "./routes/V1/feature.routes.js";
// import dotenv from "dotenv";
// dotenv.config();
import notificationRouter from "./routes/V1/notification.routes.ts"
import UserRepository from "./repositories/user.repository.ts"
import {ApiResponse} from "./utils/ApiResponse.js"
import profileRouter from "./routes/V1/profile.routes.ts"
import curriculamRouter from "./routes/V1/curriculum.routes.ts"
const app = express();
app.use(traceMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

/* ---------------- ROUTES ---------------- */
app.use("/api/V1/auth", authRoutes);
app.use("/api/V1/admin", adminRoutes);
// app.use("/api", classRoutes);
app.use("/api/V1", classRoutes);
app.use("/api/V1", sectionRoutes);
app.use("/api/V1", subjectRoutes);
app.use("/api/V1", courseRoutes);
app.use("/api/V1/teachers", teacherRoutes);
app.use("/api/V1/students", studentRoutes);
app.use("/api/V1/parents", parentRoutes);
app.use("/api/V1/auth/register", registerRoutes);

// AI Feature Routes
app.use("/api/V1", summarizeRoute);
app.use("/api/V1/ainote", ainoteRoute);
app.use("/api/V1/assessments", assessmentRoutes);

// History and Analytics Routes
app.use("/api/V1/history", historyRoutes);
app.use("/api/V1/features", featureRoutes);

// Static serving for AI server's papers
app.use("/api/V1/ai/papers", express.static("papers"));

// AI Server Routes
app.use("/api/v1/gini", giniRouter);
app.use("/api/v1/feedback", appFeedbackRouter);
app.use("/api/v1/student", performanceRouter);
app.use("/api/v1/pyq", previousPapersRouter);
app.use("/api/v1/predict", predictPapersRouter);

// profile
app.use("/api/v1/profile", profileRouter)

app.use("/api/v1/notification", notificationRouter)

app.use("/api/v1/curriculum",curriculamRouter)

app.get("/token", async (req, res)=>{
   const userId = String(req.user.user_id);
   const token = await  UserRepository.getToken(userId)
   return ApiResponse(200, token, "token")
})

/* ---------------- HEALTH CHECK ---------------- */
app.get("/health", (_, res) => {
  res.status(200).json({ status: "OK" });
});

/* ---------------- GLOBAL ERROR HANDLER ---------------- */

app.use(globalErrorHandler);

/* ---------------- START SERVER + DB ---------------- */

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
});
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    await sequelize.sync();
    console.log("✅ Tables synced");
  } catch (error) {
    console.error("❌ DB connection failed:", error);
  }
})();
