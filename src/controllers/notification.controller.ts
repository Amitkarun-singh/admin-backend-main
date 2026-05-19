import type { Request, Response } from "express";
export function notificationRegister(req: Request, res: Response) {
    const { token, deviceId } = req.body;
    const userId = req.user.user_id;
    console.log(token, deviceId, userId)
    res.status(201).json({ message: "Registration successful" })
}