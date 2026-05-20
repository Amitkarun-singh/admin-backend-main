import type { Request, Response } from "express";
import NotificationService from "../services/notification.service.ts";
export async function notificationRegister(req: Request, res: Response) {
    const { token, deviceId } = req.body;
    const userId = req.user.user_id;


    //console.log("token, deviceId, userId", token, deviceId, userId)
    try {
        const result = await NotificationService.register(token, deviceId, userId);
        if (result.code === 'TOKEN_ALREADY_EXISTS') {
            return res.status(400).json({ message: "Token already exists", result })
        }
        res.status(201).json({ message: "Registration successful", result })
    } catch (error) {
        console.log("error", error)
        res.status(500).json({ message: "Failed to register notification", error })
    }
}

export async function notificationSend(req: Request, res: Response) {
    const { title, body } = req.body;
    const userId = req.user.user_id;
    if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "Title is required or not a string", title })
    }
    if (!body || typeof body !== "string") {
        return res.status(400).json({ message: "Body is required or not a string", body })
    }
    try {
        const result = await NotificationService.send(title, body, userId);
        res.status(201).json({ message: "Notification sent successfully", result })
    } catch (error) {
        console.log("error", error)
        res.status(500).json({ message: "Failed to send notification", error })
    }
}

export async function notificationTopicSend(req: Request, res: Response) {
    const { topic, title, body } = req.body;
    if (!topic || typeof topic !== "string") {
        return res.status(400).json({ message: "Topic is required or not a string", topic })
    }
    if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "Title is required or not a string", title })
    }
    if (!body || typeof body !== "string") {
        return res.status(400).json({ message: "Body is required or not a string", body })
    }
    const userId = req.user.user_id;
    try {
        const result = await NotificationService.topicSend(topic, title, body);
        res.status(201).json({ message: "Topic send successful", result })
    } catch (error) {
        console.log("error", error)
        res.status(500).json({ message: "Failed to register notification", error })
    }
}

export async function notificationTopicUnsubscribe(req: Request, res: Response) {
    const { topic } = req.body;
    if (!topic || typeof topic !== "string") {
        return res.status(400).json({ message: "Topic is required or not a string", topic })
    }
    const userId = req.user.user_id;
    try {
        const result = await NotificationService.topicUnsubscribe(topic, userId);
        res.status(201).json({ message: "Unsubscription successful", result })
    } catch (error) {
        console.log("error", error)
        res.status(500).json({ message: "Failed to register notification", error })
    }
}

export async function notificationTopicSubscribe(req: Request, res: Response) {
    const { topics } = req.body;
    if (!topics || !Array.isArray(topics)) {
        return res.status(400).json({ message: "Topics is required", topics })
    }
    const userId = req.user.user_id;
    try {
        const result = await NotificationService.topicSubscribe(topics, userId);
        res.status(201).json({ message: "Registration successful", result })
    } catch (error) {
        console.log("error", error)
        res.status(500).json({ message: "Failed to register notification", error })
    }
}


