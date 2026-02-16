import Feature from "../models/feature.model.js";
import FeatureAccess from "../models/feature_access.model.js";
import UserFeatureAccess from "../models/user_feature_access.model.js";
import { ApiError } from "../utils/ApiError.js";

export const checkFeatureAccess = (featureKey) => {
    return async (req, res, next) => {
        const user = req.user;

        const feature = await Feature.findOne({
        where: { feature_key: featureKey, is_active: true },
        });
        if (!feature) throw new ApiError(403, "Feature disabled");

        const roleAccess = await FeatureAccess.findOne({
        where: {
            role: user.role,
            feature_id: feature.feature_id,
            has_access: true,
        },
        });
        if (!roleAccess) throw new ApiError(403, "Access denied");

        const userAccess = await UserFeatureAccess.findOne({
        where: {
            user_id: user.user_id,
            feature_id: feature.feature_id,
        },
        });

        if (userAccess) {
        if (!userAccess.is_enabled || userAccess.is_blocked) {
            throw new ApiError(403, "Feature blocked");
        }

        if (
            userAccess.usage_limit !== null &&
            userAccess.usage_count >= userAccess.usage_limit
        ) {
            await userAccess.update({ is_blocked: true });
            throw new ApiError(403, "Usage limit exceeded");
        }
        }

        req.userFeatureAccess = userAccess;
        next();
    };
};
