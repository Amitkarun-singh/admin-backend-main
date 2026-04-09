import { getDashboardData } from "./studentPerformance.service.js";

const getDashboard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.user_id;

    const data = await getDashboardData(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Dashboard load failed",
    });
  }
};

export { getDashboard };
