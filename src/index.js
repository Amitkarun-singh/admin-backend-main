// 🚨 dotenv MUST be first
import "./bootstrap.js";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import sequelize from "./config/db.js";
import "./models/index.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import classRoutes from "./routes/class.routes.js";
import sectionRoutes from "./routes/section.routes.js";
import subjectRoutes from "./routes/subject.routes.js";
import courseRoutes from "./routes/course.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import studentRoutes from "./routes/student.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import registerRoutes from "./routes/register.routes.js";

import historyRoutes from "./routes/history.routes.js";
import { globalErrorHandler } from "./error/globalErrorHandler.ts";
import { traceMiddleware } from "./ai-features/middleware/traceMiddleware.ts";

// Imports for AI features
import giniRouter from "./ai-features/gini/giniRouter.js";
import performanceRouter from "./ai-features/studentPerformance/studentPerformanceRouter.js";
import previousPapersRouter from "./ai-features/previousPapers/previousPapersRouter.js";
import predictPapersRouter from "./ai-features/predictPapers/predictPapersRouter.js";
import summarizeRoute from "./routes/summarize.routes.js";
import ainoteRoute from "./routes/ainote.routes.js";
import assessmentRoutes from "./routes/assessment.routes.js";
import appFeedbackRouter from "./ai-features/app_feedback/appFeedbackRoute.js";
import featureRoutes from "./routes/feature.routes.js";
// import dotenv from "dotenv";
// dotenv.config();
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
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api", classRoutes);
app.use("/api", classRoutes);
app.use("/api", sectionRoutes);
app.use("/api", subjectRoutes);
app.use("/api", courseRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/auth/register", registerRoutes);

// AI Feature Routes
app.use("/api", summarizeRoute);
app.use("/api/ainote", ainoteRoute);
app.use("/api/assessments", assessmentRoutes);

// History and Analytics Routes
app.use("/api/history", historyRoutes);
app.use("/api/features", featureRoutes);

// Static serving for AI server's papers
app.use("/api/ai/papers", express.static("papers"));

// AI Server Routes
app.use("/gini", giniRouter);
app.use("/feedback", appFeedbackRouter);
app.use("/student", performanceRouter);
app.use("/pyq", previousPapersRouter);
app.use("/predict", predictPapersRouter);

/* ---------------- HEALTH CHECK ---------------- */
app.get("/health", (_, res) => {
  res.status(200).json({ status: "OK", errorMessage });
});

/* ---------------- GLOBAL ERROR HANDLER ---------------- */

app.use(globalErrorHandler);

/* ---------------- START SERVER + DB ---------------- */

app.listen(process.env.PORT || 3000, () => {
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
