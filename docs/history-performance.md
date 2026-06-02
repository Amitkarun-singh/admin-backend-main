# History, User Activity & Student Performance Module — Technical Documentation
> Schools2AI Backend · v1.0

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Middleware Pipeline](#2-middleware-pipeline)
3. [Route-by-Route Deep Dive](#3-route-by-route-deep-dive)
4. [Error Reference](#4-error-reference)
5. [Complete Request Data Flow](#5-complete-request-data-flow)

---

## 1. API Overview

### History Routes — mounted under `/api/history` (or similar)

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `GET` | `/recent-queries` | Bearer JWT | Get recent AI query history for the user |
| `GET` | `/features-explored` | Bearer JWT | Get features the user has explored |
| `GET` | `/login-history` | Bearer JWT | Get login session records for the user |
| `GET` | `/week-activity` | Bearer JWT | Get 7-day activity streak summary |
| `GET` | `/stats` | Bearer JWT | Get aggregate usage stats |
| `GET` | `/latest-tests` | Bearer JWT | Get the user's most recent practice test results |
| `GET` | `/conversation/:conversation_id` | Bearer JWT | Fetch full conversation log (chatbot/tutor/practice) |

### Student Performance Routes — mounted under `/api/performance` (or similar)

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `GET` | `/performance/:studentId` | Bearer JWT | Get student performance dashboard data |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level, history routes only)

The history router registers `router.use(activityMiddleware)`. Student performance router does not.

**Reads:** `req.user?.user_id`  
**Attaches:** Nothing (background streak update)

### 2.2 `authMiddleware` — all routes (per-route)

Validates Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `GET /recent-queries`

Get a combined list of recent AI queries from chatbot and practice logs for the current user.

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Max records to return (default: `20`) |

#### Execution Flow

**Step 1 — Controller**
```ts
const user_id = Number(req.user.user_id);
const limit   = parseInt(req.query.limit as string) || 20;
const combined = await historyService.getRecentQueries(user_id, limit);
```

**Step 2 — Service: Parallel query across log tables**
```ts
const [chatbotLogs, practiceLogs] = await Promise.all([
  ChatbotLog.findAll({
    where: { user_id },
    order: [["created_at", "DESC"]],
    limit,
    attributes: ["id", "query", "created_at", "source"]
  }),
  // → SELECT id, query, created_at, 'chatbot' AS source FROM chatbot_logs
  //   WHERE user_id = ? ORDER BY created_at DESC LIMIT ?

  PracticeLog.findAll({
    where: { user_id },
    order: [["created_at", "DESC"]],
    limit,
    attributes: ["id", "subject", "chapter", "created_at"]
  })
  // → SELECT id, subject, chapter, created_at FROM practice_logs
  //   WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
]);

// Merge, sort by date desc, return top `limit`
return [...chatbotLogs, ...practiceLogs].sort((a, b) => b.created_at - a.created_at).slice(0, limit);
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "id": 1, "query": "What is photosynthesis?", "created_at": "2026-05-30T10:00:00Z", "source": "chatbot" },
    { "id": 2, "subject": "Biology", "chapter": "Photosynthesis", "created_at": "2026-05-29T08:00:00Z" }
  ],
  "message": "Recent queries fetched"
}
```

---

### 3.2 `GET /features-explored`

Get a distinct list of features the user has used (based on activity logs).

#### Execution Flow

```ts
const features = await historyService.getFeaturesExplored(user_id);
// → ActivityLog.findAll({
//     where: { user_id },
//     attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("feature_key")), "feature_key"]],
//   })
// → SELECT DISTINCT feature_key FROM activity_logs WHERE user_id = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": ["AI_NOTES", "AI_ASSESSMENT", "GINI_CHATBOT"],
  "message": "Features explored fetched"
}
```

---

### 3.3 `GET /login-history`

Get the user's past login session records.

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Max sessions to return (default: `10`) |

#### Execution Flow

```ts
const history = await historyService.getLoginHistory(user_id, limit);
// → LoginSession.findAll({
//     where: { user_id },
//     order: [["login_at", "DESC"]],
//     limit,
//     attributes: ["session_id", "ua", "ip", "login_at", "logout_at"]
//   })
// → SELECT session_id, ua, ip, login_at, logout_at FROM login_sessions
//   WHERE user_id = ? ORDER BY login_at DESC LIMIT ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "session_id": 5, "ip": "192.168.1.1", "login_at": "2026-06-01T08:00:00Z", "logout_at": "2026-06-01T09:00:00Z" }
  ],
  "message": "Login history fetched"
}
```

---

### 3.4 `GET /week-activity`

Get the user's activity for the last 7 days (daily session counts and streak status).

#### Execution Flow

```ts
const result = await historyService.getWeekActivity(user_id);
// → Queries UserStreak + daily activity aggregates

const userStreak = await UserStreak.findOne({ where: { user_id } });
// → SELECT current_streak, longest_streak, last_active_date FROM user_streaks WHERE user_id = ?

const dailyActivity = await LoginSession.findAll({
  where: { user_id, login_at: { [Op.gte]: sevenDaysAgo } },
  attributes: [[Sequelize.fn("DATE", Sequelize.col("login_at")), "date"], [Sequelize.fn("COUNT", "*"), "count"]],
  group: [Sequelize.fn("DATE", Sequelize.col("login_at"))],
});
// → SELECT DATE(login_at) AS date, COUNT(*) AS count FROM login_sessions
//   WHERE user_id = ? AND login_at >= ? GROUP BY DATE(login_at)
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {
    "current_streak": 5,
    "longest_streak": 14,
    "last_active_date": "2026-06-01",
    "week": [
      { "date": "2026-05-26", "count": 3 },
      { "date": "2026-05-27", "count": 1 }
    ]
  },
  "message": "Week activity fetched"
}
```

---

### 3.5 `GET /stats`

Get aggregate usage statistics for the current user.

#### Execution Flow

```ts
const stats = await historyService.getStats(user_id);
// Runs multiple aggregate queries in parallel:
const [totalQueries, totalTests, totalSessions] = await Promise.all([
  ChatbotLog.count({ where: { user_id } }),
  // → SELECT COUNT(*) FROM chatbot_logs WHERE user_id = ?

  Test.count({ where: { student_id: user_id } }),
  // → SELECT COUNT(*) FROM tests WHERE student_id = ?

  LoginSession.count({ where: { user_id } }),
  // → SELECT COUNT(*) FROM login_sessions WHERE user_id = ?
]);
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "total_queries": 45, "total_tests": 12, "total_sessions": 30 },
  "message": "Stats fetched"
}
```

---

### 3.6 `GET /latest-tests`

Get the most recent practice test results for the current user.

#### Execution Flow

```ts
const student_id = Number(req.user.user_id);
const results = await historyService.getLatestTests(student_id);
// → Test.findAll({
//     where: { student_id },
//     order: [["created_at", "DESC"]],
//     limit: 10,
//     include: [{ model: Question, attributes: ["type", "correct", "student_answer"] }]
//   })
// → SELECT tests.*, questions.* FROM tests
//   JOIN questions ON questions.test_id = tests.test_id
//   WHERE tests.student_id = ? ORDER BY tests.created_at DESC LIMIT 10
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "test_id": 42, "subject": "Mathematics", "chapter": "Polynomials", "score": 8, "max_score": 10, "created_at": "..." }
  ],
  "message": "Latest tests fetched"
}
```

---

### 3.7 `GET /conversation/:conversation_id`

Fetch the full message log for a conversation. The `source` query param determines which log table is queried.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `conversation_id` | string | Yes | UUID or numeric conversation ID |

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | No | `gini` (default), `tutor`, or `practice` |

#### Execution Flow

**Step 1 — Controller**
```ts
const user_id          = Number(req.user.user_id);
const { conversation_id } = req.params;
const source              = (req.query.source as string || "gini").toLowerCase();
const result = await historyService.getConversation(user_id, conversation_id, source);
```

**Step 2 — Service: Route by source**

| Source | Table queried |
|--------|---------------|
| `gini` | `chatbot_logs` |
| `tutor` | `tutor_logs` |
| `practice` | `practice_logs` |

```ts
// Example for source="gini":
return ChatbotLog.findAll({
  where: { user_id, conversation_id },
  order: [["created_at", "ASC"]],
  attributes: ["id", "role", "content", "created_at"]
});
// → SELECT id, role, content, created_at FROM chatbot_logs
//   WHERE user_id = ? AND conversation_id = ? ORDER BY created_at ASC
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "id": 1, "role": "user", "content": "What is photosynthesis?", "created_at": "2026-06-01T09:00:00Z" },
    { "id": 2, "role": "assistant", "content": "Photosynthesis is the process by which...", "created_at": "2026-06-01T09:00:01Z" }
  ],
  "message": "Conversation fetched"
}
```

---

### 3.8 `GET /performance/:studentId`

Get a comprehensive performance dashboard for a student.

> **Note:** `studentId` is a route param but the controller uses `req.user.user_id` as the actual student ID — the param is for future admin use.

#### Execution Flow

**Step 1 — Controller**
```ts
const { studentId } = req.params;
const userId = req.user?.user_id;
const data = await getDashboardData(userId);
```

**Step 2 — Service: Aggregate multiple data points**
```ts
// Runs in parallel:
const [testHistory, subjectBreakdown, streakData, recentActivity] = await Promise.all([
  Test.findAll({ where: { student_id: userId }, order: [["created_at", "DESC"]], limit: 20 }),
  // → SELECT subject, AVG(score/max_score * 100) AS avg_pct FROM tests
  //   WHERE student_id = ? GROUP BY subject

  UserStreak.findOne({ where: { user_id: userId } }),
  // → SELECT * FROM user_streaks WHERE user_id = ?

  ActivityLog.findAll({ where: { user_id: userId, created_at: { [Op.gte]: thirtyDaysAgo } } }),
]);
```

#### Response — 200 OK
```json
{
  "success": true,
  "data": {
    "streak": { "current_streak": 5, "longest_streak": 14 },
    "tests": [{ "test_id": 42, "subject": "Math", "score": 8, "max_score": 10 }],
    "subject_performance": [{ "subject": "Mathematics", "avg_percentage": 82 }],
    "recent_activity": [...]
  }
}
```

---

## 4. Error Reference

| HTTP | Class | Condition | Cause |
|------|-------|-----------|-------|
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `500` | plain JSON | — | `getDashboard` service failure |
| `500` | `ApiError` | — | Any unexpected DB error in history service |

---

## 5. Complete Request Data Flow

Full chain for `GET /conversation/:conversation_id`:

```
① HTTP GET /history/conversation/abc-123?source=gini
   → activityMiddleware    (streak update async)
   → authMiddleware        (JWT → req.user)
   → getConversation controller

② getConversation()
   → user_id = Number(req.user.user_id)
   → conversation_id = "abc-123"
   → source = "gini"
   → historyService.getConversation(user_id, "abc-123", "gini")

③ historyService.getConversation()
   → switch on source → "gini" → ChatbotLog
   → ChatbotLog.findAll({
       where: { user_id, conversation_id: "abc-123" },
       order: [["created_at", "ASC"]],
       attributes: ["id", "role", "content", "created_at"]
     })
   → SELECT id, role, content, created_at FROM chatbot_logs
     WHERE user_id = ? AND conversation_id = 'abc-123'
     ORDER BY created_at ASC

④ res.status(200).json(new ApiResponse(200, result, "Conversation fetched"))
```

---

*Schools2AI · History, Activity & Student Performance Documentation*
