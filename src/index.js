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

// Imports for AI features
import giniRouter from "./ai-features/gini/giniRouter.js";
import performanceRouter from "./ai-features/studentPerformance/studentPerformanceRouter.js";
import previousPapersRouter from "./ai-features/previousPapers/previousPapersRouter.js";
import summarizeRoute from "./routes/summarize.route.js";
import ainoteRoute from "./routes/ainote.route.js";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:8000",
      "http://localhost:8080", 
    ], // frontend URL
    credentials: true, // allow cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

/* ---------------- ROUTES ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", classRoutes);
app.use("/api", classRoutes);
app.use("/api", sectionRoutes);
app.use("/api", subjectRoutes);
app.use("/api", courseRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/parents", parentRoutes);

// AI Feature Routes
app.use("/api/summarize", summarizeRoute);
app.use("/api/ainote", ainoteRoute);

// Static serving for AI server's papers
app.use("/api/ai/papers", express.static("papers"));

// AI Server Routes
app.use("/gini", giniRouter);
app.use("/student", performanceRouter);
app.use("/pyq", previousPapersRouter);

/* ---------------- HEALTH CHECK ---------------- */
app.get("/health", (_, res) => {
  res.status(200).json({ status: "OK" });
});

/* ---------------- GLOBAL ERROR HANDLER ---------------- */
app.use((err, req, res, next) => {
  console.error(err);

  const statusCode =
    err.statuscode && Number.isInteger(err.statuscode) ? err.statuscode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
  });
});

/* ---------------- START SERVER + DB ---------------- */
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    await sequelize.sync();
    console.log("✅ Tables synced");

    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("❌ DB connection failed:", error);
    process.exit(1);
  }
})();
