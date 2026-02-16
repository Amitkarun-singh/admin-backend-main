import ParentProfile from "../models/parent_profile.model.js";
import AdminUser from "../models/admin_user.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import sequelize from "../config/db.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* =====================================================
   GET ALL PARENTS
   ===================================================== */
const getAllParents = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;

  const parents = await ParentProfile.findAll({
    where: { school_id },
    include: [
      {
        model: AdminUser,
        as: "user",
        attributes: ["username", "phone_number", "email", "status"]
      }
    ]
  });

  return res
    .status(200)
    .json(new ApiResponse(200, parents, "Parents fetched"));
});

/* =====================================================
   GET SINGLE PARENT
   ===================================================== */
const getParentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const parent = await ParentProfile.findByPk(id, {
    include: [
      {
        model: AdminUser,
        as: "user",
        attributes: ["username", "phone_number", "email", "status"]
      }
    ]
  });

  if (!parent)
    throw new ApiError(404, "Parent not found");

  return res
    .status(200)
    .json(new ApiResponse(200, parent));
});

/* =====================================================
   UPDATE PARENT
   ===================================================== */
const updateParent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const parent = await ParentProfile.findByPk(id);

  if (!parent)
    throw new ApiError(404, "Parent not found");

  await parent.update(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, parent, "Parent updated"));
});

/* =====================================================
   DELETE PARENT
   ===================================================== */
const deleteParent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const transaction = await sequelize.transaction();

  try {
    const parent = await ParentProfile.findByPk(id, { transaction });

    if (!parent)
      throw new ApiError(404, "Parent not found");

    const user_id = parent.user_id;

    // 1️⃣ Delete parent-student mappings
    await ParentStudentMap.destroy({
      where: { parent_id: id },
      transaction
    });

    // 2️⃣ Delete parent profile
    await parent.destroy({ transaction });

    // 3️⃣ Delete admin user
    await AdminUser.destroy({
      where: { user_id },
      transaction
    });

    await transaction.commit();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Parent deleted successfully"));

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});


export {
  getAllParents,
  getParentById,
  updateParent,
  deleteParent
};
