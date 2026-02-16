// import FeatureAccess from "../models/feature_access.model.js";
// import { ApiResponse } from "../utils/ApiResponse.js";
// import { asyncHandler } from "../utils/asyncHandler.js";

// /* SET ROLE FEATURE ACCESS */
// export const setRoleFeatureAccess = asyncHandler(async (req, res) => {
//     const { role, feature_id, has_access } = req.body;

//     const [access] = await FeatureAccess.upsert({
//         role,
//         feature_id,
//         has_access,
//     });

//     return res
//         .status(200)
//         .json(new ApiResponse(200, access, "Role feature access updated"));
// });

// /* GET ROLE FEATURE ACCESS */
// export const getRoleFeatureAccess = asyncHandler(async (req, res) => {
//     const { role } = req.params;

//     const accessList = await FeatureAccess.findAll({ where: { role } });

//     return res.status(200).json(new ApiResponse(200, accessList));
// });
