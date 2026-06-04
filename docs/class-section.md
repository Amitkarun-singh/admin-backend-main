# Class & Section Module — Technical Documentation
> Schools2AI Backend · v1.0

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Middleware Pipeline](#2-middleware-pipeline)
3. [Route-by-Route Deep Dive — Classes](#3-route-by-route-deep-dive--classes)
4. [Route-by-Route Deep Dive — Sections](#4-route-by-route-deep-dive--sections)
5. [Error Reference](#5-error-reference)
6. [Complete Request Data Flow](#6-complete-request-data-flow)

---

## 1. API Overview

Both class and section routes are handled by `course.controller.ts` and backed by `class.service.ts` / `section.service.ts`.

### Class Routes — mounted under `/api/classes` (or similar)

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `POST` | `/class` | Bearer JWT | None (commented out) | Create a single class |
| `POST` | `/classes/bulk` | Bearer JWT | None | Bulk-create classes (with sections) |
| `GET` | `/classes` | Bearer JWT | None | List all classes for the school |
| `GET` | `/class/student` | Bearer JWT | None | Get class of the logged-in student |
| `GET` | `/class/:id` | Bearer JWT | None | Get a class by ID |
| `PUT` | `/class/:id` | Bearer JWT | None | Update a class |
| `DELETE` | `/class/:id` | Bearer JWT | None | Delete a class with cascade |

### Section Routes — mounted under `/api/sections` (or similar)

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `POST` | `/section` | Bearer JWT | `MANAGE_SCHOOL` | Create a single section |
| `POST` | `/sections/bulk` | Bearer JWT | `MANAGE_SCHOOL` | Bulk-create sections for multiple classes |
| `GET` | `/class/:class_id/sections` | Bearer JWT | None (commented out) | Get sections by class |
| `PUT` | `/section/:id` | Bearer JWT | `MANAGE_SCHOOL` | Update a section |
| `DELETE` | `/section/:id` | Bearer JWT | `MANAGE_SCHOOL` | Delete a section |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level)

**File:** `src/middlewares/activity.middleware.ts`

Both routers register `router.use(activityMiddleware)`. Fires a background streak update for any authenticated user.

**Reads:** `req.user?.user_id`  
**Attaches:** Nothing

### 2.2 `authMiddleware` — all routes (per-route)

**File:** `src/middlewares/auth.middleware.ts`

Verifies Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

### 2.3 `requirePermission("MANAGE_SCHOOL")` — section routes only

**File:** `src/middlewares/permission.middleware.ts`

Checks `req.user.permissions.includes("MANAGE_SCHOOL")`.
Throws `ApiError(403, "Access denied")` if the permission is absent.

---

## 3. Route-by-Route Deep Dive — Classes

---

### 3.1 `POST /class`

Create a single class by name.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_name` | string | Yes | Unique class name (e.g. `"Grade 10"`) |

#### Execution Flow

**Step 1 — Controller**
```ts
const { class_name } = req.body;
const newClass = await classService.createClass(class_name);
```

**Step 2 — Service: Validate**
```ts
if (!class_name) throw new ApiError(400, "Class name required");
```

**Step 3 — Service: Insert**
```ts
return AdminClass.create({ class_name });
// → INSERT INTO admin_classes (class_name) VALUES (?)
```

#### Response — 201 Created
```json
{
  "statusCode": 201,
  "data": { "class_id": 5, "class_name": "Grade 10" },
  "message": "Class created"
}
```

---

### 3.2 `POST /classes/bulk`

Bulk-create classes, each optionally with a list of sections.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `classes` | array | Yes | Array of `{ class_name, sections?: string[] }` |

#### Execution Flow

**Step 1 — Controller**
```ts
const { classes } = req.body;
const createdClasses = await classService.bulkCreateClasses({ classes });
```

**Step 2 — Service: Validate**
```ts
if (!classes?.length) throw new ApiError(400, "classes array required");
```

**Step 3 — Service: Loop**
```ts
for (const { class_name, sections } of classes) {
  const classRow = await AdminClass.create({ class_name });
  // → INSERT INTO admin_classes (class_name) VALUES (?)

  if (sections?.length) {
    const sectionPayload = sections.map((section_name) => ({
      class_id: classRow.class_id, section_name
    }));
    await AdminSection.bulkCreate(sectionPayload);
    // → INSERT INTO admin_sections (class_id, section_name) VALUES (?, ?), ...
  }
}
```

#### Response — 201 Created
```json
{
  "statusCode": 201,
  "data": [{ "class_id": 5, "class_name": "Grade 10", "sections": [{ "section_id": 1, "section_name": "A" }] }],
  "message": "Classes created successfully"
}
```

---

### 3.3 `GET /classes`

Get all classes filtered by the requesting user's school.

#### Execution Flow

**Step 1 — Controller**
```ts
const { school_id } = req.user;
const filteredClasses = await classService.getAllClasses(school_id);
```

**Step 2 — Service: Query**
```ts
// Gets global class list + filters to classes enrolled by students of this school
return AdminClass.findAll({ order: [["class_id", "ASC"]] });
// → SELECT * FROM admin_classes ORDER BY class_id ASC
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [{ "class_id": 1, "class_name": "Grade 1" }, ...],
  "message": "Classes fetched"
}
```

---

### 3.4 `GET /class/student`

Get the class (and section) for the logged-in user. Role-aware:
- **STUDENT** → returns their enrolled class + section
- **TEACHER** → returns all classes they teach

#### Execution Flow

**Student path:**
```ts
const studentProfile = await StudentProfile.findOne({ where: { user_id } });
// → SELECT * FROM student_profiles WHERE user_id = ?
const classSection = await StudentClassSection.findOne({ where: { student_id } });
// → SELECT * FROM student_class_sections WHERE student_id = ?
if (!classSection) throw new ApiError(404, "Class not assigned to this student");

const [classRow, sectionRow] = await Promise.all([
  AdminClass.findByPk(classSection.class_id),    // SELECT ... FROM admin_classes
  AdminSection.findByPk(classSection.section_id), // SELECT ... FROM admin_sections
]);
```

**Teacher path (if no student profile):**
```ts
const teacherProfile = await TeacherProfile.findOne({ where: { user_id } });
const teacherAssignments = await TeacherClassSectionSubject.findAll({ where: { teacher_id } });
const classIds = [...new Set(teacherAssignments.map((a) => a.class_id))];
const assignedClasses = await AdminClass.findAll({ where: { class_id: classIds } });
```

#### Response — 200 OK (STUDENT)
```json
{
  "statusCode": 200,
  "data": { "student_id": 1, "class_id": 3, "class_name": "Grade 8", "section_id": 2, "section_name": "B" },
  "message": "Student class fetched"
}
```

#### Response — 200 OK (TEACHER)
```json
{
  "statusCode": 200,
  "data": { "teacher_id": 10, "class_id": 3, "class_name": "Grade 8", "classes": [{ "class_id": 3, "class_name": "Grade 8" }] },
  "message": "Teacher classes fetched"
}
```

---

### 3.5 `GET /class/:id`

Get a single class by primary key.

#### Execution Flow

```ts
const classData = await classService.getClassById(id);
// → AdminClass.findByPk(id)
if (!classData) throw new ApiError(404, "Class not found");
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "class_id": 3, "class_name": "Grade 8" },
  "message": "Class fetched"
}
```

---

### 3.6 `PUT /class/:id`

Update a class's fields.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_name` | string | No | New class name |

#### Execution Flow

```ts
const classData = await classService.updateClass(id, req.body);
// → class.update(req.body)
// → UPDATE admin_classes SET ... WHERE class_id = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "class_id": 3, "class_name": "Grade 9" },
  "message": "Class updated"
}
```

---

### 3.7 `DELETE /class/:id`

Delete a class and all related data (sections, subject assignments, student class records) in a cascade.

#### Execution Flow

```ts
await classService.deleteClass(id);
// Service runs a transaction:
await AdminSection.destroy({ where: { class_id: id }, transaction });
// → DELETE FROM admin_sections WHERE class_id = ?
await StudentClassSection.destroy({ where: { class_id: id }, transaction });
// → DELETE FROM student_class_sections WHERE class_id = ?
await AdminClass.destroy({ where: { class_id: id }, transaction });
// → DELETE FROM admin_classes WHERE class_id = ?
await transaction.commit();
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {},
  "message": "Class and related data deleted"
}
```

---

## 4. Route-by-Route Deep Dive — Sections

---

### 4.1 `POST /section`

Create a single section within a class.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_id` | number | Yes | Parent class ID |
| `section_name` | string | Yes | Section name (e.g. `"A"`) |

#### Execution Flow

**Step 1 — Controller**
```ts
const { class_id, section_name } = req.body;
const { school_id } = req.user;
const section = await sectionService.createSection({ class_id, section_name, school_id });
```

**Step 2 — Service: Validate + Insert**
```ts
if (!class_id || !section_name) throw new ApiError(400, "class_id and section_name required");
const classRow = await AdminClass.findByPk(class_id);
if (!classRow) throw new ApiError(404, "Class not found");
return AdminSection.create({ class_id, section_name, school_id });
// → INSERT INTO admin_sections (class_id, section_name, school_id) VALUES (?, ?, ?)
```

#### Response — 201 Created
```json
{
  "statusCode": 201,
  "data": { "section_id": 5, "class_id": 3, "section_name": "C" },
  "message": "Section created"
}
```

---

### 4.2 `POST /sections/bulk`

Bulk-create sections for multiple classes.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `classes` | array | Yes | Array of `{ class_id, sections: string[] }` |

#### Execution Flow

```ts
for (const { class_id, sections } of classes) {
  const payload = sections.map((section_name) => ({ class_id, section_name, school_id }));
  await AdminSection.bulkCreate(payload);
  // → INSERT INTO admin_sections (class_id, section_name, school_id) VALUES ...
}
```

#### Response — 201 Created
```json
{
  "statusCode": 201,
  "data": [...],
  "message": "Sections created successfully"
}
```

---

### 4.3 `GET /class/:class_id/sections`

Get all sections belonging to a class (for the requesting user's school).

#### Execution Flow

```ts
const { class_id } = req.params;
const { school_id } = req.user;
const sections = await sectionService.getSectionsByClass(class_id, school_id);
// → AdminSection.findAll({ where: { class_id, school_id } })
// → SELECT * FROM admin_sections WHERE class_id = ? AND school_id = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [{ "section_id": 1, "section_name": "A" }, { "section_id": 2, "section_name": "B" }],
  "message": "Sections fetched"
}
```

---

### 4.4 `PUT /section/:id`

Update a section's name (or other fields).

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `section_name` | string | No | New section name |

#### Execution Flow

```ts
const { id } = req.params;
const { school_id } = req.user;
const section = await sectionService.updateSection(id, school_id, req.body);
// → Finds section by PK + school_id, calls section.update(req.body)
// → UPDATE admin_sections SET section_name = ? WHERE section_id = ? AND school_id = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "section_id": 2, "section_name": "Z" },
  "message": "Section updated"
}
```

---

### 4.5 `DELETE /section/:id`

Delete a section and cascade-delete related student section enrollments.

#### Execution Flow

```ts
await sectionService.deleteSection(id, school_id);
// → Service runs:
await StudentClassSection.destroy({ where: { section_id: id }, transaction });
// → DELETE FROM student_class_sections WHERE section_id = ?
await AdminSection.destroy({ where: { section_id: id, school_id }, transaction });
// → DELETE FROM admin_sections WHERE section_id = ? AND school_id = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {},
  "message": "Section deleted"
}
```

---

## 5. Error Reference

| HTTP | Class | Condition | Cause |
|------|-------|-----------|-------|
| `400` | `ApiError` | — | `class_name` missing (createClass) |
| `400` | `ApiError` | — | `classes` array empty (bulkCreateClasses) |
| `400` | `ApiError` | — | `class_id` or `section_name` missing (createSection) |
| `400` | `ApiError` | — | `classes` array empty (bulkCreateSections) |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `403` | `ApiError` | — | `MANAGE_SCHOOL` permission missing (section routes) |
| `404` | `ApiError` | — | Class not found (getClassById, deleteClass) |
| `404` | `ApiError` | — | Class not assigned to student (getStudentClass student path) |
| `404` | `ApiError` | — | User profile not found (getStudentClass teacher path) |

---

## 6. Complete Request Data Flow

Full chain for `GET /class/student` (student path):

```
① HTTP GET /class/student
   → activityMiddleware    (streak update async)
   → authMiddleware        (JWT → req.user)
   → getStudentClass controller

② getStudentClass()
   → const { user_id } = req.user

③ Check student profile
   → StudentProfile.findOne({ where: { user_id } })
   → SELECT * FROM student_profiles WHERE user_id = ?

④ If student found:
   → StudentClassSection.findOne({ where: { student_id } })
   → SELECT * FROM student_class_sections WHERE student_id = ?
   → if !classSection → throw ApiError(404, "Class not assigned")

⑤ Parallel queries
   → AdminClass.findByPk(class_id)   → SELECT ... FROM admin_classes WHERE class_id = ?
   → AdminSection.findByPk(section_id) → SELECT ... FROM admin_sections WHERE section_id = ?

⑥ res.status(200).json(new ApiResponse(200, {
     student_id, class_id, class_name, section_id, section_name
   }, "Student class fetched"))
```

---

*Schools2AI · Class & Section Module Documentation*
