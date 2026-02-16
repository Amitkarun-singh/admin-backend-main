// import UserFeatureAccess from "../models/user_feature_access.model.js";
// import { ApiResponse } from "../utils/ApiResponse.js";
// import { asyncHandler } from "../utils/asyncHandler.js";

// /* SET USER FEATURE ACCESS */
// export const setUserFeatureAccess = asyncHandler(async (req, res) => {
//     const { user_id, feature_id, is_enabled, usage_limit } = req.body;

//     const [access] = await UserFeatureAccess.upsert({
//         user_id,
//         feature_id,
//         is_enabled,
//         usage_limit,
//     });

//     return res
//         .status(200)
//         .json(new ApiResponse(200, access, "User feature access updated"));
// });

// /* BLOCK USER FEATURE */
// export const blockUserFeature = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     await UserFeatureAccess.update(
//         { is_blocked: true },
//         { where: { user_feature_access_id: id } }
//     );

//     return res
//         .status(200)
//         .json(new ApiResponse(200, null, "User feature blocked"));
// });
