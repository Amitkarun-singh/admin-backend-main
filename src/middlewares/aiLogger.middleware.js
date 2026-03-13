import AiUsageLog from "../models/ai_usage_log.model.js";

export const aiLogger = (feature, action) => {
    return async (req, res, next) => {

        const start = Date.now();

        const originalJson = res.json;

        res.json = function (data) {
            res.locals.responseBody = data;
            return originalJson.call(this, data);
        };

        res.on("finish", async () => {

        try {

            const responseTime = Date.now() - start;

            const requestPayload = {
                body: req.body,
            };

            await AiUsageLog.create({
                user_id: req.user?.user_id || null,
                feature,
                action,
                endpoint: req.originalUrl,
                request_payload: requestPayload,
                response_data: res.locals.responseBody,
                response_status: res.statusCode,
                response_time_ms: responseTime,
                ip_address: req.ip
            });

        } catch (err) {
            console.error("AI logging failed:", err.message);
        }

        });

        next();
    };
};