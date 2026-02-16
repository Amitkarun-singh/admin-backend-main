// import Feature from "../models/feature.model.js";
// import { ApiResponse } from "../utils/ApiResponse.js";
// import { ApiError } from "../utils/ApiError.js";
// import { asyncHandler } from "../utils/asyncHandler.js";

// /* CREATE FEATURE */
// export const createFeature = asyncHandler(async (req, res) => {
//     const { feature_key, feature_name } = req.body;

//     if (!feature_key || !feature_name) {
//         throw new ApiError(400, "feature_key and feature_name required");
//     }

//     const feature = await Feature.create({ feature_key, feature_name });

//     return res
//         .status(201)
//         .json(new ApiResponse(201, feature, "Feature created"));
// });

// /* GET ALL FEATURES */
// export const getAllFeatures = asyncHandler(async (req, res) => {
//     const features = await Feature.findAll();
//     return res.status(200).json(new ApiResponse(200, features));
// });

// /* ENABLE / DISABLE FEATURE (GLOBAL) */
// export const toggleFeature = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { is_active } = req.body;

//     await Feature.update({ is_active }, { where: { feature_id: id } });

//     return res
//         .status(200)
//         .json(new ApiResponse(200, null, "Feature updated"));
// });
