# AI Gini Chatbot, Practice & Voice Bot Module — Technical Documentation
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

All routes in `giniRouter.routes.ts` are mounted under `/api/gini` (or similar prefix).

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `POST` | `/practice/questions` | Bearer JWT | Generate AI-powered practice questions |
| `POST` | `/practice/questions/answer-submit` | Bearer JWT | Submit an answer for a practice question |
| `GET` | `/practice/questions/test/result/:testId` | Bearer JWT | Get test results by test ID |
| `POST` | `/ai/gini` | Bearer JWT | Chat with Gini AI (SSE streaming response) |
| `POST` | `/voice-bot` | Bearer JWT | Voice bot conversation (audio file upload) |
| `POST` | `/ai/feedback/thumbs-up` | Bearer JWT | Submit positive feedback on an AI response |
| `POST` | `/ai/feedback` | Bearer JWT | Submit negative / detailed feedback on an AI response |

---

## 2. Middleware Pipeline

### 2.1 `authMiddleware` — all routes (per-route)

**File:** `src/middlewares/auth.middleware.ts`

Validates Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

### 2.2 `practiceQuestionsLog` — practice questions route

**File:** `src/middlewares/practiceQuestionsLog.middleware.js`

Logs practice question generation events to the DB before the controller runs.
Reads `req.body`, attaches a `log_id` to `req` for downstream correlation.

### 2.3 `upload.single("file")` — Gini chat route

Inline multer instance configured with `memoryStorage()` (not disk).
Stores file directly in memory as `req.file.buffer`.
Used for optional document upload alongside chat messages.

### 2.4 `chatbotLogs` — Gini chat route

**File:** `src/middlewares/chatbotLogs.middleware.js`

Logs the incoming chatbot request metadata to `chatbot_logs` before routing to the controller.

### 2.5 `rateLimitWithToken` — Gini chat route

**File:** `src/middlewares/rateLimiteWithToken.middleware.ts`

Token-bucket based rate limiter. Reads remaining token budget from the user's record.
Throws `ApiError(429)` if the user has exhausted their token quota.

### 2.6 `upload.single("user_audio")` — voice bot route

Same inline multer `memoryStorage()` instance. Stores user audio as `req.file.buffer`.

### 2.7 `tutorLogs` — voice bot route

**File:** `src/middlewares/tutorLogs.middleware.ts`

Logs voice bot session events to `tutor_logs` before the controller runs.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `POST /practice/questions`

Generate AI-powered MCQ/SA/LA practice questions for a chapter, save them to the DB, and return a test ID.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | string | Yes | Subject name (e.g. `"Mathematics"`) |
| `chapter` | string | Yes | Chapter name (e.g. `"Polynomials"`) |
| `questionType` | string[] | Yes | Array of types: `["MCQ", "SA", "LA"]` |
| `questionsCount` | object | Yes | Count per type: `{ mcq: 5, sa: 3, la: 2 }` |
| `class_` | string | No | Class name (e.g. `"Grade 10"`) |
| `language` | string | No | Language (e.g. `"English"`) |

#### Execution Flow

**Step 1 — Controller: Validate required fields**
```ts
if (!subject || !chapter || !questionType || !questionsCount)
  return res.status(400).json({ error: "Missing required fields" });
```

**Step 2 — Controller: AI generation (parallel by type)**
```ts
await Promise.all(questionType.map(async (type) => {
  const count = questionsCount[type.toLowerCase()] || 1;
  allQuestions[type] = await generatePracticeQuestions({ class_, language, subject, chapter, questionType: type, count });
  // → Calls AI model service to generate structured questions
}));
```

**Step 3 — Controller: Persist test + questions**
```ts
const testId = await insertTest([class_, subject, chapter.toString(), language, studentId]);
// → INSERT INTO tests (class, subject, chapter, language, student_id) VALUES (...)
await insertQuestions(testId, allQuestions);
// → INSERT INTO questions (test_id, type, question, options, answer, answer_explanation, marks) VALUES ...
```

#### Response — 200 OK
```json
{
  "testId": 42,
  "subject": "Mathematics",
  "chapter": "Polynomials",
  "questionType": ["MCQ", "SA"],
  "questions": {
    "MCQ": [{ "id": "q1", "question": "...", "options": ["A","B","C","D"], "answer": "A" }],
    "SA": [{ "id": "q2", "question": "...", "answer": "..." }]
  },
  "message": "AI-generated practice questions successfully created."
}
```

---

### 3.2 `POST /practice/questions/answer-submit`

Submit a student's answer for a specific question in an active test.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `questionId` | number | Yes | Question ID to answer |
| `testId` | number | Yes | Test ID from `/practice/questions` |
| `answer` | string | Yes | Student's answer |

#### Execution Flow

**Step 1 — Controller → Service**
```ts
await submitAnswer(questionId, testId, answer);
// → UPDATE questions SET student_answer = ? WHERE question_id = ? AND test_id = ?
```

#### Response — 200 OK
```json
{ "isSuccessful": true }
```

---

### 3.3 `GET /practice/questions/test/result/:testId`

Get the graded results for a completed test.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `testId` | number | Yes | Test ID |

#### Execution Flow

**Step 1 — Controller → Service**
```ts
const testId = Number(req.params.testId);
const result = await testResult(testId);
// → Loads all questions for test, compares student_answer vs answer
// → Computes score per question, total score
```

#### Response — 200 OK
```json
{
  "isSuccessful": true,
  "result": {
    "test_id": 42,
    "total_score": 8,
    "max_score": 10,
    "questions": [{ "question_id": 1, "is_correct": true, "marks_obtained": 1 }]
  }
}
```

---

### 3.4 `POST /ai/gini`

Chat with the Gini AI. Supports an optional file upload. Responds with **Server-Sent Events (SSE)** for streaming.

#### Request

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | string (JSON) | Yes | JSON-stringified array of `{ role, content }` message history |
| `language` | string | No | Preferred response language |
| `class` | string | No | Class context for AI |
| `subject` | string | No | Subject/chapter context |
| `file` | file | No | Optional document (in memory buffer) |

#### Execution Flow

**Step 1 — Controller: Validate `messages`**
```ts
if (!messagesRaw) throw new ValidationError([{ field: "messages", code: "REQUIRED" }]);
messages = JSON.parse(messagesRaw);
if (!Array.isArray(messages)) throw new ValidationError([{ field: "messages", code: "ARRAY_REQUIRED" }]);
```

**Step 2 — Controller: Set SSE headers**
```ts
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
res.flushHeaders();
```

**Step 3 — Service: Stream AI response**
```ts
await streamChatbotResponse(messages, res, uploadedFile, { language, className, chapter });
// → Sends AI tokens to the client as SSE `data:` chunks
// → Each token: res.write(`data: ${token}\n\n`)
// → End: res.write("data: [DONE]\n\n"); res.end();
```

#### Response — SSE Stream
```
Content-Type: text/event-stream

data: The answer to your question is...
data:  polynomial
data:  equations
data: [DONE]
```

---

### 3.5 `POST /voice-bot`

Accepts user audio, sends it for transcription + AI response, returns text (and optionally audio) reply.

#### Request

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_audio` | file | Yes | Audio file (stored in memory buffer) |
| Additional body fields | any | No | Session context |

#### Execution Flow

**Step 1 — Controller → Service**
```ts
await voiceBotController(req, res);
// → Reads req.file.buffer (audio bytes)
// → Transcribes audio → AI generates text response → optionally TTS
```

#### Response — 200 OK
```json
{
  "isSuccessful": true,
  "transcript": "What is the quadratic formula?",
  "response": "The quadratic formula is x = (-b ± √(b²-4ac)) / 2a",
  "audio_url": "https://cdn.example.com/tts/response.mp3"
}
```

---

### 3.6 `POST /ai/feedback/thumbs-up`

Submit positive feedback (thumbs up) on an AI response.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message_id` | string | Yes | ID of the AI message being rated |
| `session_id` | string | No | Chat session ID |

#### Execution Flow

```ts
await feedbackThumbUpService(req.body);
// → UPDATE chatbot_logs SET feedback = 'thumbs_up' WHERE message_id = ?
```

#### Response — 200 OK
```json
{ "isSuccessful": true }
```

---

### 3.7 `POST /ai/feedback`

Submit negative or detailed feedback on an AI response.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message_id` | string | Yes | ID of the AI message being rated |
| `feedback_type` | string | No | e.g. `"thumbs_down"`, `"incorrect"`, `"harmful"` |
| `comment` | string | No | Free-text feedback from user |

#### Execution Flow

```ts
await feedbackThumbDownService(req.body);
// → UPDATE chatbot_logs SET feedback = feedback_type, comment = comment WHERE message_id = ?
```

#### Response — 200 OK
```json
{ "isSuccessful": true }
```

---

## 4. Error Reference

| HTTP | Class | Code | Cause |
|------|-------|------|-------|
| `400` | `ValidationError` | `REQUIRED` | `messages` field is missing |
| `400` | `ValidationError` | `INVALID_JSON` | `messages` field is not valid JSON |
| `400` | `ValidationError` | `ARRAY_REQUIRED` | Parsed `messages` is not an array |
| `400` | plain JSON | — | `subject`, `chapter`, `questionType`, or `questionsCount` missing |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `429` | `ApiError` | — | Token quota exhausted (rateLimitWithToken) |
| `500` | plain JSON | — | AI generation failure |
| `500` | plain JSON | — | Test result fetch failure |

---

## 5. Complete Request Data Flow

Full chain for `POST /ai/gini` (Gini chatbot):

```
① HTTP POST /ai/gini
   → authMiddleware            (JWT → req.user)
   → upload.single("file")     (multer memoryStorage → req.file)
   → chatbotLogs               (INSERT into chatbot_logs; attaches log_id to req)
   → rateLimitWithToken        (checks token budget; throws 429 if exceeded)
   → chatbotController

② chatbotController()
   → Parse + validate req.body.messages JSON array
   → Validate language, class, subject fields
   → res.setHeader("Content-Type", "text/event-stream")
   → res.flushHeaders()

③ streamChatbotResponse(messages, res, uploadedFile, { language, className, chapter })
   → If uploadedFile: extract text from buffer (OCR / PDF parse)
   → Build AI prompt with context
   → Call AI model API (streaming mode)

④ For each streamed token:
   → res.write(`data: ${token}\n\n`)

⑤ On completion:
   → res.write("data: [DONE]\n\n")
   → res.end()
```

---

*Schools2AI · AI Gini Chatbot, Practice & Voice Bot Documentation*
