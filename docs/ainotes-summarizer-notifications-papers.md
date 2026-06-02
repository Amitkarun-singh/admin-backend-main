# AI Notes, Summarizer, Notifications & Papers Module — Technical Documentation
> Schools2AI Backend · v1.0

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Middleware Pipeline](#2-middleware-pipeline)
3. [Route-by-Route Deep Dive — AI Notes](#3-route-by-route-deep-dive--ai-notes)
4. [Route-by-Route Deep Dive — Summarizer](#4-route-by-route-deep-dive--summarizer)
5. [Route-by-Route Deep Dive — Notifications](#5-route-by-route-deep-dive--notifications)
6. [Route-by-Route Deep Dive — Papers](#6-route-by-route-deep-dive--papers)
7. [Route-by-Route Deep Dive — App Feedback](#7-route-by-route-deep-dive--app-feedback)
8. [Error Reference](#8-error-reference)

---

## 1. API Overview

### AI Notes Routes (`ainote.routes.js`) — public, no auth currently (commented out)

| Method | Endpoint | Auth | Feature Gate | Purpose |
|--------|----------|------|-------------|---------|
| `GET` | `/languages` | None | None | Get distinct available languages |
| `GET` | `/boards` | None | None | Get boards for a language |
| `GET` | `/classes` | None | None | Get classes for language + board |
| `GET` | `/streams` | None | None | Get streams (Class 11/12 only) |
| `GET` | `/subjects` | None | None | Get subjects for language+board+class |
| `GET` | `/chapters` | None | None | Get chapters for a subject |
| `GET` | `/` | None | None | Search/list AI notes |
| `POST` | `/` | None | None | Create AI notes (with file upload) |

### Summarizer Routes (`summarize.routes.js`)

| Method | Endpoint | Auth | Feature Gate | Purpose |
|--------|----------|------|-------------|---------|
| `POST` | `/summarize` | Bearer JWT | 18 (DOC_SUMMARISER) | Upload a document + get AI summary |

### Notification Routes (`notification.routes.ts`) — no `activityMiddleware`

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/register` | Bearer JWT | Register an FCM device token |
| `POST` | `/send` | Bearer JWT | Send push notification to self |
| `POST` | `/topic-send` | Bearer JWT | Send push notification to a topic |
| `POST` | `/topic-unsubscribe` | Bearer JWT | Unsubscribe from a topic |
| `POST` | `/topic-subscribe` | Bearer JWT | Subscribe to topics (array) |

### Predict Papers Routes (`predictPapers.router.ts`) — no auth

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/papers` | None | Fetch AI-predicted papers |
| `GET` | `/papers/preview` | None | Get signed preview URL for a paper |
| `GET` | `/papers/download` | None | Get signed download URL for a paper |
| `GET` | `/papers/subject` | None | Get available subjects |
| `GET` | `/papers/classes` | None | Get available classes |

### Previous Papers Routes (`previousPapers.router.js`) — no auth

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/papers` | None | Fetch previous year papers |
| `GET` | `/papers/preview` | None | Get signed preview URL |
| `GET` | `/papers/download` | None | Get signed download URL |
| `GET` | `/papers/years` | None | Get available years |
| `GET` | `/papers/subject` | None | Get available subjects |
| `GET` | `/papers/classes` | None | Get available classes |

### App Feedback Routes (`appFeedback.route.ts`) — no auth

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/` | None | Submit app feedback (contact form) |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — `ainote.routes.js` + `summarize.routes.js` only

Registered via `router.use(activityMiddleware)`. Since auth is commented out on AI notes, it skips silently for public routes.

### 2.2 `authMiddleware` — summarizer + notification routes (per-route)

Validates Bearer JWT → sets `req.user`.

### 2.3 `requireFeature(18)` — summarizer route

Feature ID `18 = DOC_SUMMARISER`. Same 4-step resolution as other `requireFeature` gates:
1. School grant check (`school_features` table)
2. Resolve class/section for STUDENT
3. Query `feature_overrides` (most-specific-wins: user > section > class > role)
4. Deny with specific message if disabled

### 2.4 `aiLogger("summarizer", "generate_summary")` — summarizer route

**File:** `src/middlewares/aiLogger.middleware.ts`

Logs AI request metadata to an AI audit log table before the handler runs.
Sets `req.log_id` for downstream correlation.

### 2.5 `upload.single("file")` — AI notes GET route (via `multer.middleware.ts`)

**File:** `src/middlewares/multer.middleware.ts`

Saves files to `./public/temp/` with timestamp filename.

### 2.6 `upload.fields([{ name: "notes" }, { name: "books" }])` — AI notes POST route

Same multer config but accepts up to 50 files per field.
`req.files.notes[]` and `req.files.books[]` are arrays of `Express.Multer.File`.

---

## 3. Route-by-Route Deep Dive — AI Notes

### 3.1 Dropdown Chain (GET `/languages`, `/boards`, `/classes`, `/streams`, `/subjects`, `/chapters`)

These 6 endpoints form a cascading dropdown chain for the AI notes creation UI.

| Step | Endpoint | Query Params | What it returns |
|------|----------|-------------|----------------|
| 1 | `GET /languages` | None | Distinct language list |
| 2 | `GET /boards` | `?language=` | Boards available for that language |
| 3a | `GET /classes` | `?language=&board=` | Classes (no stream needed) |
| 3b | `GET /streams` | `?language=&board=` | Streams (for Class 11/12) |
| 4 | `GET /subjects` | `?language=&board=&class=[&stream=]` | Subjects |
| 5 | `GET /chapters` | `?language=&board=&class=&subject=[&stream=]` | Chapters |

**Execution pattern (same for all)**
```ts
// Example: getLanguages
const data = await AiNoteService.getLanguages();
// → SELECT DISTINCT language FROM ai_notes ORDER BY language ASC
res.status(200).json({ success: true, data });
```

---

### 3.2 `GET /`

Search/list AI notes by filter.

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `language` | string | Language filter |
| `board` | string | Board filter |
| `class` | string | Class filter |
| `subject` | string | Subject filter |
| `topic` | string | Chapter/topic filter |
| `stream` | string | Stream filter (Class 11/12) |

#### Execution Flow

```ts
const data = await AiNoteService.getAiNotes(req.query);
// → ainoteRepository.findNotes(filters)
// → SELECT * FROM ai_notes WHERE language = ? AND board = ? AND class = ? ...
//   (optional filters applied dynamically)
res.status(200).json({ success: true, count: data.length, data });
```

#### Response — 200 OK
```json
{
  "success": true,
  "count": 3,
  "data": [{ "note_id": 1, "topic": "Polynomials", "short_note": "...", "file_url": "..." }]
}
```

---

### 3.3 `POST /`

Create AI notes for one or more chapters. Supports optional file uploads (`notes` and `books` fields).

#### Request Body (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `language` | string | Yes | Language (e.g. `English`) |
| `board` | string | Yes | Board (e.g. `CBSE`) |
| `class` | string | Yes | Class name |
| `subject` | string | Yes | Subject name |
| `chapters` | string (JSON) | Yes | JSON-serialized array of chapter names |
| `stream` | string | No | Stream (for Class 11/12) |
| `short_notes` | string (JSON) | No | JSON array of short note texts, one per chapter |
| `noteChapterIndices` | string (JSON) | No | Chapter indices that have note files |
| `bookChapterIndices` | string (JSON) | No | Chapter indices that have book files |
| `created_by` | string | No | Creator identifier |
| `notes` | file[] | No | Up to 50 note PDF/files |
| `books` | file[] | No | Up to 50 book PDF/files |

#### Execution Flow

**Step 1 — Controller: Parse JSON fields**
```ts
const chapterList    = JSON.parse(chapters) as string[];
const shortNotesList = shortNotesRaw  ? JSON.parse(shortNotesRaw)  : [];
const noteIndices    = noteIndicesRaw ? JSON.parse(noteIndicesRaw) : [];
const bookIndices    = bookIndicesRaw ? JSON.parse(bookIndicesRaw) : [];
```

**Step 2 — Service: Per-chapter loop**
```ts
for (let i = 0; i < chapterList.length; i++) {
  const chapter    = chapterList[i];
  const shortNote  = shortNotesList[i] ?? null;
  const noteFile   = noteIndices.includes(i) ? noteFiles[noteIndices.indexOf(i)] : null;
  const bookFile   = bookIndices.includes(i) ? bookFiles[bookIndices.indexOf(i)] : null;

  // Upload files to storage
  const noteUrl = noteFile ? await uploadFile(noteFile) : null;
  const bookUrl = bookFile ? await uploadFile(bookFile) : null;

  // Upsert AI note record
  await ainoteRepository.upsert({
    language, board, class: className, subject, stream, chapter, short_note: shortNote,
    note_file_url: noteUrl, book_file_url: bookUrl, created_by
  });
  // → INSERT INTO ai_notes (...) ON DUPLICATE KEY UPDATE ...
}
```

**Step 3 — Controller: Cleanup temp files (always)**
```ts
cleanupTempFiles(req.files); // fs.unlinkSync each uploaded file
```

#### Response — 200 OK
```json
{
  "success": true,
  "message": "Notes uploaded successfully",
  "results": [{ "chapter": "Polynomials", "status": "created", "note_id": 10 }]
}
```

---

## 4. Route-by-Route Deep Dive — Summarizer

### 4.1 `POST /summarize`

Upload a document and receive an AI-generated summary in the requested language.

**Feature Gate:** `requireFeature(18)` = `DOC_SUMMARISER`

#### Request Body (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Document to summarize (PDF, DOCX, TXT, image, etc.) |
| `language` | string | Yes | Language for the summary |
| `maxlength` | number | No | Maximum word/token length of the summary |

#### Execution Flow

**Step 1 — Controller: Validate**
```ts
if (!language) return res.status(400).json({ success: false, message: "language is required" });
if (!file)     return res.status(400).json({ success: false, message: "file is required" });
```

**Step 2 — Controller → Service**
```ts
const result = await summarizerService.generateSummary({
  language,
  maxlength: maxlength ? Number(maxlength) : undefined,
  filePath: file.path,
  mimeType: file.mimetype,
  originalname: file.originalname,
});
// → Reads file, extracts text, calls AI model, returns { file: metadata, summary: text }
```

#### Response — 200 OK
```json
{
  "success": true,
  "message": "Summary generated successfully",
  "file": { "name": "document.pdf", "size": 102400 },
  "summary": "This document discusses the principles of thermodynamics..."
}
```

---

## 5. Route-by-Route Deep Dive — Notifications

### 5.1 `POST /register`

Register an FCM (Firebase Cloud Messaging) device token for push notifications.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | FCM device token |
| `deviceId` | string | Yes | Unique device identifier |

#### Execution Flow

```ts
const userId = req.user.user_id;
const result = await NotificationService.register(token, deviceId, userId);
// → Checks if token already registered
// → If exists: return { code: "TOKEN_ALREADY_EXISTS" } → 400
// → If new: INSERT INTO device_tokens (user_id, token, device_id) VALUES (...)
```

#### Response — 201 Created
```json
{ "message": "Registration successful", "result": { "token_id": 5 } }
```

---

### 5.2 `POST /send`

Send a push notification to all devices registered by the current user.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Notification title |
| `body` | string | Yes | Notification body text |

#### Execution Flow

```ts
await NotificationService.send(title, body, userId);
// → Loads all FCM tokens for user
// → admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } })
```

#### Response — 201 Created
```json
{ "message": "Notification sent successfully", "result": { "successCount": 2, "failureCount": 0 } }
```

---

### 5.3 `POST /topic-send`

Send a push notification to all subscribers of a topic.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | FCM topic name |
| `title` | string | Yes | Notification title |
| `body` | string | Yes | Notification body |

```ts
await NotificationService.topicSend(topic, title, body);
// → admin.messaging().send({ topic, notification: { title, body } })
```

---

### 5.4 `POST /topic-unsubscribe`

Unsubscribe the current user's devices from a topic.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | Topic to unsubscribe from |

```ts
await NotificationService.topicUnsubscribe(topic, userId);
// → Loads user tokens → admin.messaging().unsubscribeFromTopic(tokens, topic)
```

---

### 5.5 `POST /topic-subscribe`

Subscribe the current user's devices to one or more topics.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topics` | string[] | Yes | Array of topic names to subscribe to |

```ts
await NotificationService.topicSubscribe(topics, userId);
// → Loads user tokens
// → For each topic: admin.messaging().subscribeToTopic(tokens, topic)
```

---

## 6. Route-by-Route Deep Dive — Papers

Both **predictPapers** and **previousPapers** follow the same pattern. The only difference is `previousPapers` requires a `year` filter.

### Predict Papers

#### `GET /papers`

| Query Param | Required | Description |
|-------------|----------|-------------|
| `board` | Yes | Board name |
| `className` | Yes | Class name |
| `subject` | Yes | Subject name |

```ts
const papers = await getPapers({ board, className, subject });
// → Queries storage/DB for papers matching the filter
// → If empty: 404 "Paper not found"
res.json(papers);
```

#### `GET /papers/preview`

| Query Param | Required | Description |
|-------------|----------|-------------|
| `filePath` | Yes | Cloud storage path of the paper |

```ts
const result = await getFilePreviewUrl(filePath);
// → Generates a signed URL (e.g. Firebase Storage or S3) valid for ~15 min
res.status(200).json(result); // { previewUrl: "https://..." }
```

#### `GET /papers/download`

| Query Param | Required | Description |
|-------------|----------|-------------|
| `filePath` | Yes | Storage path |
| `fileName` | No | Friendly file name for download |

```ts
const result = await getFileDownloadUrl(filePath, fileName);
// → Generates a signed download URL with Content-Disposition: attachment
res.status(200).json(result); // { downloadUrl: "https://...", fileName: "..." }
```

#### `GET /papers/subject` & `GET /papers/classes`

```ts
// subjects
const result = await getSubjects({ board, className });
// → SELECT DISTINCT subject FROM predict_papers WHERE board = ? AND class = ?

// classes
const result = await getClasses({ board });
// → SELECT DISTINCT class FROM predict_papers WHERE board = ?
```

### Previous Papers — Additional Route

#### `GET /papers/years`

| Query Param | Required | Description |
|-------------|----------|-------------|
| `board` | Yes | Board name |

```ts
const result = await getYears({ board });
// → SELECT DISTINCT year FROM previous_papers WHERE board = ? ORDER BY year DESC
res.status(200).json(result);
```

---

## 7. Route-by-Route Deep Dive — App Feedback

### 7.1 `POST /` (appFeedback)

Submit a contact form / app feedback. No authentication required.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Sender name |
| `email` | string | Yes | Sender email (validated by regex) |
| `subject` | string | Yes | Feedback subject |
| `message` | string | Yes | Feedback message |

#### Execution Flow

**Step 1 — Validate**
```ts
if (!name || !email || !subject || !message)
  throw { status: 400, message: "All fields are required" };
if (!validateEmail(email))
  throw { status: 400, message: "Invalid email" };
// validateEmail → /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
```

**Step 2 — Send via email service**
```ts
await appFeedbackService({ name, email, subject, message });
// → Sends email via nodemailer/SendGrid to the admin inbox
// → OR inserts into app_feedback table
```

#### Response — 201 Created (empty body)
```
HTTP 201 Created
(no body)
```

---

## 8. Error Reference

### AI Notes Errors
| HTTP | Format | Condition |
|------|--------|-----------|
| `400` | `{ success: false, message }` | `ValidationError` from service |
| `500` | `{ success: false, message }` | Unexpected error |

### Summarizer Errors
| HTTP | Format | Condition |
|------|--------|-----------|
| `400` | `{ success: false, message: "language is required" }` | Missing language |
| `400` | `{ success: false, message: "file is required" }` | Missing file |
| `401` | `ApiError` | Missing/invalid JWT |
| `403` | `ApiError` | Feature `DOC_SUMMARISER` not enabled |
| `500` | `{ success: false, message }` | AI summary generation failure |

### Notification Errors
| HTTP | Format | Condition |
|------|--------|-----------|
| `400` | `{ message }` | `title`, `body`, `topic`, or `topics` missing or not string/array |
| `400` | `{ message, result }` | FCM token already registered |
| `401` | `ApiError` | Missing/invalid JWT |
| `500` | `{ message, error }` | FCM API failure |

### Papers Errors
| HTTP | Format | Condition |
|------|--------|-----------|
| `400` | `{ message }` | Missing required query params (`board`, `className`, `subject`, `year`) |
| `400` | `{ error }` | Missing `filePath` query param (preview/download) |
| `404` | `{ message }` | No papers found matching filters |
| `500` | `{ message }` / `{ error }` | Storage URL generation failure or DB error |

### App Feedback Errors
| HTTP | Format | Condition |
|------|--------|-----------|
| `400` | `{ message }` | Missing fields or invalid email |
| `500` | `{ message }` | Email/DB service failure |

---

*Schools2AI · AI Notes, Summarizer, Notifications & Papers Documentation*
