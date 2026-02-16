import {
  getOverallScore,
  getTimeSpent,
  getCounts,
  getSubjectMastery,
  getMonthlyProgress,
  getLatestTests,
  getTimeSpentBetweenDates,
} from "./studentPerformance.model.js";

export const getDashboardData = async (studentId) => {
  const today = new Date();

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 7);

  const startOfLastWeek = new Date(today);
  startOfLastWeek.setDate(today.getDate() - 14);

  const formatDate = (date) => date.toISOString().split("T")[0];

  const [
    overallScore,
    totalTime,
    counts,
    subjectMastery,
    monthlyProgress,
    latestTests,
    thisWeekMinutes,
    lastWeekMinutes,
  ] = await Promise.all([
    getOverallScore(studentId),
    getTimeSpent(studentId),
    getCounts(),
    getSubjectMastery(studentId),
    getMonthlyProgress(studentId),
    getLatestTests(studentId),
    getTimeSpentBetweenDates(
      studentId,
      formatDate(startOfWeek),
      formatDate(today),
    ),
    getTimeSpentBetweenDates(
      studentId,
      formatDate(startOfLastWeek),
      formatDate(startOfWeek),
    ),
  ]);

  const percentageChange =
    lastWeekMinutes === 0
      ? 100
      : Math.round(
          ((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100,
        );

  return {
    summary: {
      overallScore: overallScore?.overallScore ?? 0,
      totalTimeMinutes: totalTime?.totalMinutes ?? 0,
      totalQuestions: counts.totalQuestions,
      totalTests: counts.totalTests,
    },

    progressChart: monthlyProgress,

    subjectMastery: subjectMastery.map((item) => ({
      label: item.name,
      value: item.score,
    })),

    latestTests,

    weeklyTime: {
      hours: Math.round(thisWeekMinutes / 60),
      percentageChange,
    },
  };
};
