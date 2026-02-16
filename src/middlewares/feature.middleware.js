import Feature from "../models/feature.model.js";
import FeatureAccess from "../models/feature_access.model.js";
import UserFeatureAccess from "../models/user_feature_access.model.js";
import { ApiError } from "../utils/ApiError.js";

export const checkFeatureAccess = (featureKey) => {
    return async (req, res, next) => {
        const user = req.user;

        /* 1️⃣ Feature globally active */
        const feature = await Feature.findOne({
        where: { feature_key: featureKey, is_active: true },
        });

        if (!feature) {
        throw new ApiError(403, "Feature disabled");
        }

        /* 2️⃣ Role based access */
        const roleAccess = await FeatureAccess.findOne({
        where: {
            role: user.role,
            feature_id: feature.feature_id,
            has_access: true,
        },
        });

        if (!roleAccess) {
        throw new ApiError(403, "Feature not allowed for role");
        }

        /* 3️⃣ User specific access */
        const userAccess = await UserFeatureAccess.findOne({
        where: {
            user_id: user.user_id,
            feature_id: feature.feature_id,
        },
        });

        if (userAccess) {
        if (!userAccess.is_enabled) {
            throw new ApiError(403, "Feature disabled by admin");
        }

        if (userAccess.is_blocked) {
            throw new ApiError(403, "Feature usage limit exceeded");
        }

        if (
            userAccess.usage_limit !== null &&
            userAccess.usage_count >= userAccess.usage_limit
        ) {
            await userAccess.update({ is_blocked: true });
            throw new ApiError(403, "Feature usage limit exceeded");
        }
        }

        /* Attach for controller usage */
        req.feature = feature;
        req.userFeatureAccess = userAccess;

        next();
    };
};
