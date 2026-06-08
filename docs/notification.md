# Notification API Documentation

## Base URL

```
/api/v1/notification
```

## Authentication

All endpoints require authentication via `authMiddleware`.

Include the access token in the request headers:

```http
Authorization: Bearer <access_token>
```

Authenticated user information is extracted from:

```ts
req.user.user_id
```

---

# 1. Register Device for Notifications

Register a device and Firebase token for push notifications.

### Endpoint

```http
POST /api/v1/notification/register
```

### Request Body

```json
{
  "token": "firebase_fcm_token",
  "deviceId": "device_unique_id"
}
```

### Request Example

```json
{
  "token": "eH12Kj8....",
  "deviceId": "android_123456"
}
```

### Success Response

```json
{
  "message": "Registration successful",
  "result": {}
}
```

### Error Response

```json
{
  "message": "Token already exists",
  "result": {
    "code": "TOKEN_ALREADY_EXISTS"
  }
}
```

### Status Codes

| Code | Description             |
| ---- | ----------------------- |
| 201  | Registration successful |
| 400  | Token already exists    |
| 500  | Internal server error   |

---

# 2. Send Notification to Current User

Send a push notification to all registered devices of the authenticated user.

### Endpoint

```http
POST /api/v1/notification/send
```

### Request Body

```json
{
  "title": "Welcome",
  "body": "Your course has been updated."
}
```

### Success Response

```json
{
  "message": "Notification sent successfully",
  "result": {}
}
```

### Validation Errors

```json
{
  "message": "Title is required or not a string"
}
```

or

```json
{
  "message": "Body is required or not a string"
}
```

### Status Codes

| Code | Description           |
| ---- | --------------------- |
| 201  | Notification sent     |
| 400  | Validation error      |
| 500  | Internal server error |

---

# 3. Send Notification to Topic

Send a notification to all users subscribed to a specific topic.

### Endpoint

```http
POST /api/v1/notification/topic-send
```

### Request Body

```json
{
  "topic": "class_10_math",
  "title": "New Chapter Added",
  "body": "Chapter 5 is now available."
}
```

### Success Response

```json
{
  "message": "Topic send successful",
  "result": {}
}
```

### Status Codes

| Code | Description           |
| ---- | --------------------- |
| 201  | Notification sent     |
| 400  | Validation error      |
| 500  | Internal server error |

---

# 4. Subscribe User to Topics

Subscribe the authenticated user to one or more notification topics.

### Endpoint

```http
POST /api/v1/notification/topic-subscribe
```

### Request Body

```json
{
  "topics": [
    "class_10_math",
    "class_10_science",
    "exam_updates"
  ]
}
```

### Success Response

```json
{
  "message": "Registration successful",
  "result": {}
}
```

### Validation Error

```json
{
  "message": "Topics is required"
}
```

### Status Codes

| Code | Description             |
| ---- | ----------------------- |
| 201  | Subscription successful |
| 400  | Validation error        |
| 500  | Internal server error   |

---

# 5. Unsubscribe User from Topic

Remove the authenticated user from a notification topic.

### Endpoint

```http
POST /api/v1/notification/topic-unsubscribe
```

### Request Body

```json
{
  "topic": "class_10_math"
}
```

### Success Response

```json
{
  "message": "Unsubscription successful",
  "result": {}
}
```

### Validation Error

```json
{
  "message": "Topic is required or not a string"
}
```

### Status Codes

| Code | Description               |
| ---- | ------------------------- |
| 201  | Unsubscription successful |
| 400  | Validation error          |
| 500  | Internal server error     |

---

# Topic Naming Convention

Recommended topic formats:

```text
class_10_math
class_10_science
class_12_physics
exam_updates
school_announcements
course_123
batch_456
```

Avoid:

```text
Class 10 Math
Math Topic
Topic#1
```

Use lowercase and underscores for consistency.

---

# Typical Mobile App Flow

## First Login

1. User logs in.
2. App obtains FCM token.
3. Call:

```http
POST /register
```

4. Store device registration.

---

## Subscribe to Subjects

```http
POST /topic-subscribe
```

```json
{
  "topics": [
    "class_10_math",
    "exam_updates"
  ]
}
```

---

## Send Personal Notification

Backend/Admin:

```http
POST /send
```

```json
{
  "title": "Welcome",
  "body": "Thanks for joining."
}
```

---

## Send Broadcast Notification

Backend/Admin:

```http
POST /topic-send
```

```json
{
  "topic": "exam_updates",
  "title": "Exam Schedule Released",
  "body": "Check the latest timetable."
}
```

---

# Notes

* All APIs require authentication.
* FCM token must be refreshed whenever the device token changes.
* A user can register multiple devices.
* A user can subscribe to multiple topics.
* Topic notifications are delivered to all devices subscribed to that topic.
* Personal notifications are delivered only to the authenticated user's registered devices.
