import {
  getSummary,
  getSubjectMastery,
  getMonthlyProgress,
  getLatestTests,
} from "./studentPerformance.model.js";

export const getDashboardData = async (studentId) => {
  console.log("Dashboard");
  const [summary, subjectMastery, progressChart, latestTests] =
    await Promise.all([
      getSummary(studentId),
      getSubjectMastery(studentId),
      getMonthlyProgress(studentId),
      getLatestTests(studentId),
    ]);
  console.log("Dashboard sql complete");
  return {
    success: true,
    data: {
      summary: {
        overallScore: summary?.overallScore ?? 0,
        totalQuestions: summary?.totalQuestions ?? 0,
        totalTests: summary?.totalTests ?? 0,
        totalCorrectAnswers: summary?.totalCorrectAnswers ?? 0,
      },

      progressChart,

      subjectMastery: subjectMastery.map((item) => ({
        label: item.label,
        value: item.value,
      })),

      latestTests,
    },
  };
};
