import UserRepository from "../repositories/user.repository.ts";
import RoleRepository from "../repositories/role.repository.ts";
import ProfileRepository from "../repositories/profile.repository.ts";
import ClassRepository from "../repositories/class.repository.ts";


class NotificationService {
    async register(token: string, deviceId: string, userId: number) {
        const { school_id: schoolId, role_id: roleId } = await UserRepository.findById(userId);
        const { role_name } = await RoleRepository.findById(roleId);
        let profile
        if (role_name == "STUDENT") {
            profile = await ProfileRepository.findStudentByUserId(userId);
        }
        else if (role_name == "TEACHER") {
            profile = await ProfileRepository.findTeacherByUserId(userId);
        } else if (role_name == "ADMIN") {
            //profile = await ProfileRepository.findAdminByUserId(userId);
        }
        const classNmae = await ClassRepository.findById(profile.teacher_id);
        const section = await ClassRepository.findSectionById(profile.teacher_id);
        console.log("classNmae", classNmae)
        console.log("section", section)
        console.log("profile", profile.teacher_id)
        console.log("schoolId", schoolId)
        console.log("roleId", roleId)
        console.log("role", role_name)


        const resp = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                token,
                deviceId,
                userId
            })
        });
        if (!resp.ok) {
            const json = await resp.json();
            if (json.code === 'TOKEN_ALREADY_EXISTS') {
                return json;
            }
            throw new Error("Failed to register notification");
        }
        const json = await resp.json();
        return json;
    }
    async send(token: string, deviceId: string, userId: number) {
        const resp = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/send-individuals`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                token,
                deviceId,
                userId
            })
        });
        if (!resp.ok) {
            throw new Error("Failed to register notification");
        }
        const json = await resp.json();
        console.log("JSON", json)
        return json;
    }

    async topicSend(topic: string, title: string, body: string) {
        const resp = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/send-topic`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                topic,
                title,
                body
            })
        });
        if (!resp.ok) {
            throw new Error("Failed to send topic notification");
        }
        const json = await resp.json();
        console.log("JSON", json)
        return json;
    }

    async topicUnsubscribe(topic: string, userId: number) {
        const resp = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/unsubscribe-topic`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                topic,

                userId
            })
        });
        if (!resp.ok) {
            throw new Error("Failed to register notification");
        }
        const json = await resp.json();
        console.log("JSON", json)
        return json;
    }

    async topicSubscribe(topics: string[], userId: number) {
        for (const topic of topics) {
            const resp = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/subscribe-topic`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    topic,

                    userId
                })
            });
            if (!resp.ok) {
                throw new Error(`Failed to register notification topic ${topic}`);
            }
            const json = await resp.json();
            console.log(`JSON for topic ${topic}`, json)
        }
        return { message: "Subscription successful" }
    }
}

export default new NotificationService()