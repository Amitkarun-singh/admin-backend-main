import TopicService from "./topic.service.js";


class NotificationService {
    async register(token: string, deviceId: string, userId: number) {



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
        const topics = await TopicService.createTopics(userId);
        console.log("TOPICS", topics)
        this.topicSubscribe(topics, userId);
        return json;
    }
    async send(title: string, body: string, userId: number) {
        const resp = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/send-individuals`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                body,
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