# Course, Class & Subject Module — Technical Documentation
> Schools2AI Backend · v1.0

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Middleware Pipeline](#2-middleware-pipeline)
3. [Route-by-Route Deep Dive — Courses](#3-route-by-route-deep-dive--courses)
4. [Route-by-Route Deep Dive — Subjects & Chapters](#4-route-by-route-deep-dive--subjects--chapters)
5. [Error Reference](#5-error-reference)
6. [Complete Request Data Flow](#6-complete-request-data-flow)

---

## 1. API Overview

### Course Routes — mounted under `/api/courses` (or similar)

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `POST` | `/course` | Bearer JWT | `MANAGE_COURSES` | Create a new course |
| `GET` | `/courses` | Bearer JWT | `MANAGE_COURSES` | List all courses for the school |
| `GET` | `/course/:id` | Bearer JWT | `MANAGE_COURSES` | Get a course by ID |
| `PUT` | `/course/:id` | Bearer JWT | `MANAGE_COURSES` | Update a course |
| `DELETE` | `/course/:id` | Bearer JWT | `MANAGE_COURSES` | Delete a course |

### Subject & Chapter Routes — mounted under `/api/subjects` (or similar)

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `POST` | `/subjects` | Bearer JWT | None (commented out) | Add subjects with chapters |
| `GET` | `/subjects` | Bearer JWT | None (commented out) | Get subjects (auto-resolves class/board/language from user) |
| `GET` | `/subjects/:class_id/chapters/:subject_id` | Bearer JWT | None | Get chapters for a subject |
| `PUT` | `/subjects/:subject_id` | Bearer JWT | None | Update subject name |
| `DELETE` | `/subjects/:subject_id` | Bearer JWT | None | Delete subject and its chapters |
| `POST` | `/subjects/:subject_id/chapters` | Bearer JWT | None | Add chapters to an existing subject |
| `PUT` | `/chapters/:chapter_id` | Bearer JWT | None | Update a chapter name |
| `DELETE` | `/chapters/:chapter_id` | Bearer JWT | None | Delete a chapter |

> **Note on Subject permissions:** `requirePermission("MANAGE_SCHOOL")` is commented out in `subject.routes.js`. Any authenticated user can access these endpoints.

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — subject routes only (router-level)

**File:** `src/middlewares/activity.middleware.ts`

The subject router registers `router.use(activityMiddleware)`. The course router does not. Fires background streak update after `authMiddleware` sets `req.user`.

### 2.2 `authMiddleware` — all routes (per-route)

**File:** `src/middlewares/auth.middleware.ts`

Verifies Bearer JWT → attaches `req.user = { user_id, role, permissions[], school_id }`.

### 2.3 `requirePermission("MANAGE_COURSES")` — course routes only

**File:** `src/middlewares/permission.middleware.ts`

```ts
const userPermissions: string[] = req.user?.permissions ?? [];
if (!userPermissions.includes("MANAGE_COURSES"))
  throw new ApiError(403, "Access denied");
```

---

## 3. Route-by-Route Deep Dive — Courses

---

### 3.1 `POST /course`

Create a new course linked to the admin's school.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `course_name` | string | Yes | Name of the course |
| `course_type` | string | No | Type classification |
| `language` | string | No | Language of the course |
| `ai_features` | object | No | JSON config for AI features |

#### Execution Flow

**Step 1 — Controller**
```ts
const { school_id } = req.user;
const { course_name, course_type, language, ai_features } = req.body;
const course = await courseService.createCourse({ school_id, course_name, course_type, language, ai_features });
```

**Step 2 — Service: validate**
```ts
if (!course_name) throw new ApiError(400, "Course name required");
```

**Step 3 — Repository: create**
```ts
return courseRepository.create({ school_id, course_name, course_type, language, ai_features, status: "active" });
// → AdminCourse.create(data)
// → INSERT INTO admin_courses (school_id, course_name, ..., status) VALUES (?, ?, ..., 'active')
```

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": { "course_id": 3, "course_name": "Science Basics", "status": "active", "school_id": 1 },
  "message": "Course created"
}
```

---

### 3.2 `GET /courses`

Fetch all courses for the requesting user's school.

#### Execution Flow

```ts
const courses = await courseService.getAllCourses(school_id);
// → courseRepository.findAllBySchool(school_id)
// → AdminCourse.findAll({ where: { school_id } })
// → SELECT * FROM admin_courses WHERE school_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{ "course_id": 1, "course_name": "Mathematics", "language": "English" }],
  "message": "Courses fetched"
}
```

---

### 3.3 `GET /course/:id`

Get a single course by primary key.

#### Execution Flow

```ts
const course = await courseService.getCourseById(id);
// → courseRepository.findById(id)
// → AdminCourse.findByPk(id)
if (!course) throw new ApiError(404, "Course not found");
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "course_id": 3, "course_name": "Science Basics", "ai_features": {} },
  "message": "Course fetched"
}
```

---

### 3.4 `PUT /course/:id`

Update any fields of a course.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Any `AdminCourse` field | any | No | Fields to update |

#### Execution Flow

```ts
const course = await courseService.getCourseById(id); // Guard 404
return courseRepository.update(course, body);
// → course.update(body)
// → UPDATE admin_courses SET ... WHERE course_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "course_id": 3, "course_name": "Advanced Science" },
  "message": "Course updated"
}
```

---

### 3.5 `DELETE /course/:id`

Delete a course record permanently.

#### Execution Flow

```ts
const course = await courseService.getCourseById(id); // Guard 404
await courseRepository.delete(course);
// → course.destroy()
// → DELETE FROM admin_courses WHERE course_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {},
  "message": "Course deleted"
}
```

---

## 4. Route-by-Route Deep Dive — Subjects & Chapters

---

### 4.1 `POST /subjects`

Add one or more subjects (with their chapters) to a class. Creates the subject if it doesn't exist (upsert on uniqueness key `class_id + board + language + subject_name`).

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_id` | number | Yes | Target class |
| `board` | string | Yes | Board (e.g. `CBSE`) |
| `language` | string | Yes | Language (e.g. `English`) |
| `subjects` | array | Yes | Array of `{ subject_name, chapters: string[] }` |

#### Execution Flow

**Step 1 — Controller**
```ts
const { class_id, board, language, subjects } = req.body;
await subjectService.addSubjectsWithChapters({ class_id, board, language, subjects });
```

**Step 2 — Service: Validate**
```ts
if (!class_id || !board || !language || !subjects?.length)
  throw new Error("class_id, board, language and subjects required");
```

**Step 3 — Service: Verify class exists**
```ts
const classData = await subjectRepository.findClassById(class_id);
// → AdminClass.findByPk(class_id)
if (!classData) throw new Error("Class not found"); // → 404
```

**Step 4 — Service: Transaction loop**
```ts
const transaction = await sequelize.transaction();
for (const subjectData of subjects) {
  const { subject_name, chapters } = subjectData;
  if (!subject_name || !chapters?.length)
    throw new Error("Each subject must have subject_name and chapters");

  // Upsert subject
  let subject = await subjectRepository.findSubjectByUnique({ class_id, board, language, subject_name });
  // → AdminSubject.findOne({ where: { class_id, board, language, subject_name } })
  if (!subject) {
    subject = await subjectRepository.createSubject({ class_id, board, language, subject_name }, transaction);
    // → INSERT INTO admin_subject_masters (...) VALUES (...)
  }

  // Bulk insert chapters
  const chapterPayload = chapters.map((chapterName, index) => ({
    subject_id: subject.subject_id, class_id, board_name: board, language,
    chapter_name: chapterName, chapter_order: index + 1, status: "active",
  }));
  await subjectRepository.bulkCreateChapters(chapterPayload, transaction);
  // → AdminChapterMaster.bulkCreate([...])
}
await transaction.commit();
```

#### Response — 201 Created

```json
{ "success": true, "message": "Subjects and Chapters added successfully" }
```

---

### 4.2 `GET /subjects`

Get subjects filtered by `class_id`, `board`, and `language`. These can be provided as query params or auto-resolved from the requesting user's profile.

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `class_id` | number | No | Class filter (auto-resolved from student profile if absent) |
| `board` | string | No | Board filter (auto-resolved from school if absent) |
| `language` | string | No | Language filter (auto-resolved from student's `preferred_language` if absent) |

#### Execution Flow

**Step 1 — Controller**
```ts
const { class_id, board, language } = req.query;
const user_id = req.user.user_id;
const result = await subjectService.getSubjects({ class_id, board, language, user_id });
```

**Step 2 — Service: Auto-resolve missing params**
```ts
if (!class_id || !board || !language) {
  const user = await subjectRepository.findUserById(user_id);
  // → User.findOne({ where: { user_id }, attributes: ["user_id","school_id"] })
  if (!user) throw new Error("User not found");

  if (!board && user.school_id) {
    const school = await subjectRepository.findSchoolById(user.school_id);
    // → AdminSchool.findOne({ where: { school_id }, attributes: ["board"] })
    if (school) board = school.board;
  }

  const studentProfile = await subjectRepository.findStudentProfile(user_id);
  // → StudentProfile.findOne({ where: { user_id }, attributes: ["student_id","preferred_language"] })

  if (!language && studentProfile?.preferred_language) language = studentProfile.preferred_language;

  if (!class_id && studentProfile?.student_id) {
    const classSection = await subjectRepository.findStudentClassSection(studentProfile.student_id);
    // → StudentClassSection.findOne({ where: { student_id, status: "active" }, attributes: ["class_id"] })
    if (classSection) class_id = classSection.class_id;
  }
}
```

**Step 3 — Service: Build where clause + query**
```ts
const where = {};
if (class_id) where.class_id = class_id;
if (board)    where.board    = board;
if (language) where.language = language;

const subjects = await subjectRepository.findAllSubjects(where);
// → AdminSubject.findAll({ where })
// → SELECT * FROM admin_subject_masters WHERE class_id = ? AND board = ? AND language = ?
return { resolved: { class_id, board, language }, subjects };
```

#### Response — 200 OK

```json
{
  "success": true,
  "resolved": { "class_id": 2, "board": "CBSE", "language": "English" },
  "data": [{ "subject_id": 3, "subject_name": "Mathematics" }]
}
```

---

### 4.3 `GET /subjects/:class_id/chapters/:subject_id`

Get all active chapters for a subject in a class, ordered by `chapter_order`.

#### Execution Flow

```ts
const { class_id, subject_id } = req.params;
const chapters = await subjectService.getChapters(class_id, subject_id);
// → subjectRepository.findChaptersByClassAndSubject(class_id, subject_id)
// → AdminChapterMaster.findAll({
//     where: { class_id, subject_id, status: "active" },
//     order: [["chapter_order", "ASC"]],
//     raw: true
//   })
```

#### Response — 200 OK

```json
{
  "success": true,
  "data": [
    { "chapter_id": 1, "chapter_name": "Real Numbers", "chapter_order": 1 },
    { "chapter_id": 2, "chapter_name": "Polynomials", "chapter_order": 2 }
  ]
}
```

---

### 4.4 `PUT /subjects/:subject_id`

Update a subject's name.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject_name` | string | Yes | New name for the subject |

#### Execution Flow

```ts
const { subject_id } = req.params;
const { subject_name } = req.body;
// Service validates subject_name is non-empty
const subject = await subjectRepository.findSubjectById(subject_id);
// → AdminSubject.findByPk(subject_id)
if (!subject) throw new Error("Subject not found"); // → 404
subject.subject_name = subject_name;
await subject.save();
// → UPDATE admin_subject_masters SET subject_name = ? WHERE subject_id = ?
```

#### Response — 200 OK

```json
{ "success": true, "message": "Subject updated successfully" }
```

---

### 4.5 `DELETE /subjects/:subject_id`

Delete a subject and all its chapters in a transaction.

#### Execution Flow

```ts
const transaction = await sequelize.transaction();
// Step 1: Delete all chapters
await subjectRepository.deleteChaptersBySubject(subject_id, transaction);
// → AdminChapterMaster.destroy({ where: { subject_id }, transaction })

// Step 2: Delete the subject
await subjectRepository.deleteSubjectById(subject_id, transaction);
// → AdminSubject.destroy({ where: { subject_id }, transaction })

await transaction.commit();
```

#### Response — 200 OK

```json
{ "success": true, "message": "Subject deleted successfully" }
```

---

### 4.6 `POST /subjects/:subject_id/chapters`

Add new chapters to an existing subject (skips duplicates by name).

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chapters` | string[] | Yes | Array of chapter names to add |

#### Execution Flow

```ts
const { subject_id } = req.params;
const { chapters } = req.body;
if (!chapters?.length) throw new Error("chapters array required");

const subject = await subjectRepository.findSubjectById(subject_id);
if (!subject) throw new Error("Subject not found"); // → 404

const classData = await subjectRepository.findClassById(subject.class_id);
if (!classData) throw new Error("Class not found"); // → 404

// Deduplicate
const existingChapters = await subjectRepository.findExistingChapters(subject_id);
// → AdminChapterMaster.findAll({ where: { subject_id } })
const existingNames = existingChapters.map((c) => c.chapter_name);

const payload = chapters
  .filter((name) => !existingNames.includes(name))  // Skip duplicates
  .map((name, index) => ({
    subject_id, class_id: subject.class_id, board_name: subject.board,
    language: subject.language, chapter_name: name.trim(),
    chapter_order: index + 1, status: "active",
  }));

await subjectRepository.bulkCreateChapters(payload);
// → AdminChapterMaster.bulkCreate([...])
```

#### Response — 201 Created

```json
{ "success": true, "message": "Chapters added successfully" }
```

---

### 4.7 `PUT /chapters/:chapter_id`

Update a chapter's name.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chapter_name` | string | Yes | New chapter name |

#### Execution Flow

```ts
const chapter = await subjectRepository.findChapterById(chapter_id);
// → AdminChapterMaster.findByPk(chapter_id)
if (!chapter) throw new Error("Chapter not found"); // → 404
chapter.chapter_name = chapter_name;
await chapter.save();
// → UPDATE admin_chapter_masters SET chapter_name = ? WHERE chapter_id = ?
```

#### Response — 200 OK

```json
{ "success": true, "message": "Chapter updated successfully" }
```

---

### 4.8 `DELETE /chapters/:chapter_id`

Delete a single chapter.

#### Execution Flow

```ts
const deleted = await subjectRepository.deleteChapterById(chapter_id);
// → AdminChapterMaster.destroy({ where: { chapter_id } })
// Returns number of deleted rows
if (!deleted) throw new Error("Chapter not found"); // → 404
```

#### Response — 200 OK

```json
{ "success": true, "message": "Chapter deleted successfully" }
```

---

## 5. Error Reference

### Course Errors

| HTTP | Class | Condition | Cause |
|------|-------|-----------|-------|
| `400` | `ApiError` | `!course_name` | Course name is missing |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `403` | `ApiError` | — | `MANAGE_COURSES` permission missing |
| `404` | `ApiError` | `!course` | Course not found by ID |

### Subject & Chapter Errors

| HTTP | Response Format | Condition | Cause |
|------|----------------|-----------|-------|
| `400` | `{ success: false, message }` | Missing `class_id`, `board`, `language`, or `subjects` | Required fields not provided |
| `400` | `{ success: false, message }` | Subject missing `subject_name` or empty `chapters` | Per-subject validation |
| `400` | `{ success: false, message }` | `chapters` array empty (addChaptersToSubject) | Validation |
| `400` | `{ success: false, message }` | `chapter_name` empty | Validation |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `404` | `{ success: false, message }` | Class not found | `class_id` doesn't match any record |
| `404` | `{ success: false, message }` | Subject not found | `subject_id` doesn't match any record |
| `404` | `{ success: false, message }` | Chapter not found | `chapter_id` not found or zero rows deleted |
| `404` | `{ success: false, message }` | User not found | `user_id` from JWT doesn't match any user |
| `500` | `{ success: false, message }` | Unexpected DB error | Various |

---

## 6. Complete Request Data Flow

Full chain for `POST /subjects` (add subjects with chapters):

```
① HTTP POST /subjects
   → activityMiddleware     (fires streak update async)
   → authMiddleware         (JWT → req.user)
   → addSubjectsWithChapters controller

② addSubjectsWithChapters()
   → const { class_id, board, language, subjects } = req.body
   → subjectService.addSubjectsWithChapters({ class_id, board, language, subjects })

③ subjectService.addSubjectsWithChapters()
   → Validates required fields
   → subjectRepository.findClassById(class_id)
     → AdminClass.findByPk(class_id)
   → sequelize.transaction()

④ For each subject in subjects array:
   → subjectRepository.findSubjectByUnique({ class_id, board, language, subject_name })
     → AdminSubject.findOne({ where: { class_id, board, language, subject_name } })
   → If not found:
     → subjectRepository.createSubject({ class_id, board, language, subject_name }, transaction)
     → INSERT INTO admin_subject_masters (...) VALUES (...)
   → Build chapter payload array
   → subjectRepository.bulkCreateChapters(chapterPayload, transaction)
     → AdminChapterMaster.bulkCreate([...])
     → INSERT INTO admin_chapter_masters (...) VALUES (...), (...), ...

⑤ transaction.commit()

⑥ res.status(201).json({ success: true, message: "Subjects and Chapters added successfully" })
```

---

*Schools2AI · Course, Class & Subject Module Documentation*
