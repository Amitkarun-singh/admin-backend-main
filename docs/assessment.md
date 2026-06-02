# Assessment Module — Technical Documentation
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

All assessment endpoints are mounted under `/api/assessments` (or similar). Every route uses `authMiddleware` and `requireFeature(13)` (Feature ID `13 = AI_ASSESSMENT`).

| Method | Endpoint | Auth | Feature Gate | Role Target | Purpose |
|--------|----------|------|-------------|-------------|---------|
| `POST` | `/` | JWT | 13 | TEACHER | Create assessment + AI-generate questions |
| `DELETE` | `/:assessment_id` | JWT | 13 | TEACHER | Delete (or archive) an assessment |
| `GET` | `/teacher/my` | JWT | 13 | TEACHER | Get assessments created by this teacher |
| `GET` | `/user/all` | JWT | 13 | Any | Get all assessments for logged-in user |
| `GET` | `/student/assigned` | JWT | 13 | STUDENT | Get tests assigned to student within time window |
| `GET` | `/assignment/:assignment_id/results` | JWT | 13 | TEACHER/ADMIN | All student results for an assignment |
| `GET` | `/attempt/:attempt_id/result` | JWT | 13 | STUDENT/TEACHER | Get result for a specific attempt |
| `POST` | `/attempt/start` | JWT | 13 | STUDENT | Start or resume an attempt |
| `POST` | `/attempt/submit` | JWT | 13 | STUDENT | Submit an attempt |
| `GET` | `/attempt/:attempt_id/questions` | JWT | 13 | STUDENT | Get questions for an existing attempt |
| `GET` | `/:assessment_id` | JWT | 13 | TEACHER | Get one assessment with all questions |
| `GET` | `/:assessment_id/all-results` | JWT | 13 | TEACHER | All student results for one assessment |
| `DELETE` | `/:assessment_id` | JWT | 13 | TEACHER | Delete or archive assessment |
| `PATCH` | `/questions/:question_id` | JWT | 13 | TEACHER | Review a question (approve/edit/delete/regenerate) |
| `PATCH` | `/:assessment_id/questions/approve-all` | JWT | 13 | TEACHER | Approve all pending questions at once |
| `POST` | `/:assessment_id/questions` | JWT | 13 | TEACHER | Add a question manually (auto-approved) |
| `PATCH` | `/:assessment_id/publish` | JWT | 13 | TEACHER | Publish assessment |
| `POST` | `/:assessment_id/assign` | JWT | 13 | TEACHER | Assign to class/sections with time window |

---

## 2. Middleware Pipeline

### 2.1 `authMiddleware` — all routes (router-level)

Registered via `router.use(authMiddleware)`. Validates Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

### 2.2 `activityMiddleware` — all routes (router-level)

Registered via `router.use(activityMiddleware)`. Fires a background streak update for every authenticated request.

### 2.3 `requireFeature(13)` — all routes (router-level)

**File:** `src/middlewares/feature.middleware.ts`

Feature ID `13 = AI_ASSESSMENT`. Blocks access if the school or the user's role/class/section has the feature disabled.

**Step 1 — School-level check**
```ts
const schoolGrant = await SchoolFeature.findOne({ where: { school_id, feature_id: 13, is_enabled: true } });
if (!schoolGrant) throw new ApiError(403, "This feature is not available for your school.");
```

**Step 2 — Resolve class + section (STUDENT only)**
```ts
// Runs raw SQL join: student_profiles → student_class_sections
const [cs] = await sequelize.query<{ class_id, section_id }>(
  `SELECT scs.class_id, scs.section_id FROM student_profiles sp
   JOIN student_class_section scs ON scs.student_id = sp.student_id
   WHERE sp.user_id = :uid LIMIT 1`,
  { replacements: { uid: user_id }, type: QueryTypes.SELECT }
);
```

**Step 3 — Check feature_overrides (most-specific-wins)**
```ts
// Priority: user > section > class > role
const [override] = await sequelize.query(
  `SELECT is_enabled, target_type FROM feature_overrides
   WHERE school_id = :sid AND feature_id = :fid AND (
     (target_type = 'user' AND target_id = :uid) OR
     (target_type = 'section' AND target_id = :sec_id) OR
     (target_type = 'class' AND target_id = :cls_id) OR
     (target_type = 'role' AND target_role = :role)
   )
   ORDER BY FIELD(target_type, 'user', 'section', 'class', 'role') LIMIT 1`,
  { ... }
);
if (override && !override.is_enabled) throw new ApiError(403, messages[override.target_type]);
```

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `POST /`

Create an assessment and generate questions using AI.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Assessment title |
| `class_id` | number | Yes | Target class |
| `subject_id` | number | Yes | Subject |
| `chapter_id` | number | No | Specific chapter |
| `question_types` | string[] | Yes | e.g. `["MCQ", "SA"]` |
| `questions_count` | object | Yes | Count per type: `{ mcq: 5, sa: 3 }` |
| `total_marks` | number | No | Total marks |
| `language` | string | No | Language for questions |

#### Execution Flow

**Step 1 — Controller**
```ts
const { user_id, school_id } = req.user;
const result = await createAssessmentService(user_id, school_id, req.body);
```

**Step 2 — Service: Validate + find class**
```ts
const classRow = await AdminClass.findByPk(class_id);
if (!classRow) throw new ApiError(404, "Class not found");
```

**Step 3 — Service: Create assessment record**
```ts
const assessment = await Assessment.create({
  created_by: user_id, school_id, class_id, subject_id,
  title, total_marks, status: "draft",
});
// → INSERT INTO assessments (...) VALUES (...)
```

**Step 4 — Service: AI question generation**
```ts
const questions = await generateQuestionsAI({ class_id, subject_id, chapter_id, question_types, questions_count, language });
// → Returns array of generated question objects
// Failure → sets result.aiFailed = true → controller returns 207
```

**Step 5 — Service: Bulk insert questions**
```ts
await AssessmentQuestion.bulkCreate(questions.map((q) => ({
  assessment_id: assessment.assessment_id,
  question_text: q.question, type: q.type,
  options: q.options, correct_answer: q.answer,
  marks: q.marks, status: "pending",
})));
// → INSERT INTO assessment_questions (...) VALUES ...
```

#### Response — 201 Created
```json
{
  "statusCode": 201,
  "data": {
    "assessment": { "assessment_id": 1, "title": "Math Test", "status": "draft", "class_name": "Grade 10" },
    "questions": [{ "question_id": 10, "type": "MCQ", "question_text": "...", "status": "pending" }]
  },
  "message": "Assessment created with AI questions"
}
```

#### Response — 207 (AI failed)
```json
{
  "statusCode": 207,
  "data": { "assessment": { "assessment_id": 1 } },
  "message": "Assessment created but AI generation failed. Add questions manually."
}
```

---

### 3.2 `DELETE /:assessment_id`

Delete an assessment. If students have already started attempts, the assessment is **archived** (status = `"archived"`) instead of deleted.

#### Execution Flow

```ts
const result = await deleteAssessmentService(assessment_id, user_id);
// → Check if any attempt exists: AssessmentAttempt.count({ where: { assessment_id } })
// → If attempts exist: assessment.update({ status: "archived" })
//   → UPDATE assessments SET status = 'archived' WHERE assessment_id = ?
// → Else: assessment.destroy()
//   → DELETE FROM assessments WHERE assessment_id = ?
```

#### Response — 200 OK (archived)
```json
{
  "statusCode": 200,
  "data": { "assessment_id": 1, "status": "archived" },
  "message": "Assessment archived (students have attempts — data preserved)"
}
```

---

### 3.3 `GET /teacher/my`

Get all assessments created by the current teacher.

#### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by assessment status (`draft`, `published`, `archived`) |
| `class_id` | number | Filter by class |
| `subject_id` | number | Filter by subject |

#### Execution Flow

```ts
const data = await getTeacherAssessmentsService(user_id, { status, class_id, subject_id });
// → Assessment.findAll({ where: { created_by: user_id, ...filters }, include: [questions count] })
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [{ "assessment_id": 1, "title": "Math Test", "status": "published", "question_count": 10 }],
  "message": "Teacher assessments fetched"
}
```

---

### 3.4 `GET /student/assigned`

Get tests assigned to the logged-in student that are within the active time window.

#### Execution Flow

```ts
const data = await getStudentAssignedTestsService(user_id);
// → Find student's class_id + section_id
// → AssessmentAssignment.findAll({
//     where: { (class_id or section_id matches student), scheduled_at <= NOW(), deadline >= NOW() },
//     include: [assessment details]
//   })
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [{ "assignment_id": 5, "title": "Math Quiz", "deadline": "2026-06-10T12:00:00Z" }],
  "message": "Assigned tests fetched"
}
```

---

### 3.5 `POST /attempt/start`

Start or resume a student's attempt for an assignment.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assignment_id` | number | Yes | Assignment ID |

#### Execution Flow

```ts
const result = await startAttemptService(user_id, assignment_id);
// → Find or create AssessmentAttempt: { student_id, assignment_id, status: "in_progress", started_at: NOW() }
// → Return shuffled questions
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {
    "attempt_id": 7,
    "questions": [{ "question_id": 10, "question_text": "...", "options": ["A","B","C","D"] }]
  },
  "message": "Attempt started"
}
```

---

### 3.6 `POST /attempt/submit`

Submit a completed attempt and get the score.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attempt_id` | number | Yes | Attempt to submit |
| `answers` | array | Yes | Array of `{ question_id, selected_answer }` |

#### Execution Flow

```ts
const { attempt, assignment, answerRows, totalObtained } = await submitAttemptService(user_id, req.body);
// → Mark attempt status = "submitted", submitted_at = NOW()
// → Grade each answer: compare selected_answer vs correct_answer
// → Calculate totalObtained
// → attempt.update({ status: "submitted", total_marks_obtained: totalObtained })
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {
    "attempt_id": 7,
    "submitted_at": "2026-06-01T14:00:00Z",
    "total_marks_obtained": 8,
    "total_marks_possible": 10,
    "percentage": 80,
    "answers": [{ "question_id": 10, "is_correct": true }]
  },
  "message": "Attempt submitted successfully"
}
```

---

### 3.7 `PATCH /questions/:question_id`

Review a question. Supports four actions: `approve`, `edit`, `delete`, `regenerate`.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | `"approve"`, `"edit"`, `"delete"`, or `"regenerate"` |
| `question_text` | string | For `edit` | Updated question text |
| `options` | string[] | For `edit` | Updated options |
| `correct_answer` | string | For `edit` | Updated answer |

#### Execution Flow per Action

| Action | DB Operation |
|--------|-------------|
| `approve` | `UPDATE assessment_questions SET status = 'approved' WHERE question_id = ?` |
| `edit` | `UPDATE assessment_questions SET question_text = ?, options = ?, correct_answer = ? WHERE question_id = ?` |
| `delete` | `DELETE FROM assessment_questions WHERE question_id = ?` |
| `regenerate` | Call AI → replace question fields → `UPDATE` |

---

### 3.8 `PATCH /:assessment_id/questions/approve-all`

Approve all questions with `status = "pending"` for an assessment.

```ts
const updatedCount = await AssessmentQuestion.update(
  { status: "approved" },
  { where: { assessment_id, status: "pending" } }
);
// → UPDATE assessment_questions SET status = 'approved' WHERE assessment_id = ? AND status = 'pending'
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "approved": 10 },
  "message": "10 question(s) approved"
}
```

---

### 3.9 `PATCH /:assessment_id/publish`

Publish a draft assessment (status → `"published"`).

```ts
const assessment = await Assessment.findByPk(assessment_id);
if (!assessment || assessment.status !== "draft") throw new ApiError(400, "...");
await assessment.update({ status: "published" });
// → UPDATE assessments SET status = 'published' WHERE assessment_id = ?
```

---

### 3.10 `POST /:assessment_id/assign`

Assign a published assessment to one or more classes or sections with a time window.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_ids` | number[] | No | Classes to assign to |
| `section_ids` | number[] | No | Sections to assign to |
| `scheduled_at` | string | Yes | ISO datetime (start time) |
| `deadline` | string | Yes | ISO datetime (end time) |
| `show_result_immediately` | boolean | No | Whether students see results immediately |

#### Execution Flow

```ts
const result = await assignAssessmentService(user_id, assessment_id, req.body);
// → Bulk create AssessmentAssignment rows:
await AssessmentAssignment.bulkCreate(rows);
// → INSERT INTO assessment_assignments (assessment_id, class_id, section_id, scheduled_at, deadline, ...) VALUES ...
```

---

## 4. Error Reference

| HTTP | Class | Condition | Cause |
|------|-------|-----------|-------|
| `400` | `ApiError` | — | Assessment not in `draft` status when publishing |
| `400` | `ApiError` | — | AI generation failed (207 returned instead of 400) |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `403` | `ApiError` | — | Feature 13 not enabled for the school |
| `403` | `ApiError` | — | Feature disabled via override for user/section/class/role |
| `404` | `ApiError` | — | Class not found (createAssessment) |
| `404` | `ApiError` | — | Assessment not found |
| `404` | `ApiError` | — | Question not found |
| `404` | `ApiError` | — | Assignment not found (startAttempt) |
| `500` | plain JSON | — | Unexpected DB/service error |

---

## 5. Complete Request Data Flow

Full chain for `POST /` (create assessment):

```
① HTTP POST /api/assessments
   → authMiddleware          (JWT → req.user)
   → activityMiddleware      (streak update async)
   → requireFeature(13)      (school grant check + override resolution)
   → createAssessment controller

② createAssessment()
   → createAssessmentService(user_id, school_id, req.body)

③ createAssessmentService()
   → AdminClass.findByPk(class_id)
   → Assessment.create({ created_by, school_id, class_id, subject_id, title, status: "draft" })
   → INSERT INTO assessments (...) VALUES (...)

④ AI question generation
   → generateQuestionsAI({ class_id, subject_id, chapter_id, question_types, counts, language })
   → Calls external AI API
   → If fails: return { aiFailed: true } → controller returns 207

⑤ Bulk insert questions
   → AssessmentQuestion.bulkCreate([...])
   → INSERT INTO assessment_questions (...) VALUES (...), (...)...

⑥ Controller:
   → if (result.aiFailed) → res.status(207).json(...)
   → else → res.status(201).json(new ApiResponse(201, { assessment, questions }, "..."))
```

---

*Schools2AI · Assessment Module Documentation*
