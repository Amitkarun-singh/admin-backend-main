# Teacher Module — Technical Documentation
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

All teacher endpoints are mounted under the prefix configured in `index.js` (typically `/api/teachers`).

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `POST` | `/teacher` | Bearer JWT | `MANAGE_SCHOOL` | Create a single teacher |
| `POST` | `/teachers/bulk` | Bearer JWT | `MANAGE_SCHOOL` | Bulk-create teachers from Excel |
| `GET` | `/teachers` | Bearer JWT | `MANAGE_SCHOOL` | List all teachers for the school |
| `GET` | `/teacher/:id` | Bearer JWT | `MANAGE_SCHOOL` | Get teacher by `teacher_id` |
| `PUT` | `/teacher/:id` | Bearer JWT | `MANAGE_SCHOOL` | Update teacher profile + assignments |
| `DELETE` | `/teacher/:id` | Bearer JWT | `MANAGE_SCHOOL` | Delete teacher + linked records |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level)

**File:** `src/middlewares/activity.middleware.ts`

Registered via `router.use(activityMiddleware)`. Fires a background streak update for every authenticated request. Does not block the response.

**Reads:** `req.user?.user_id`  
**Attaches:** Nothing

### 2.2 `authMiddleware` — all routes (per-route)

**File:** `src/middlewares/auth.middleware.ts`

Validates Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

Throws `ApiError(401)` on missing/invalid token.

### 2.3 `requirePermission("MANAGE_SCHOOL")` — all routes

**File:** `src/middlewares/permission.middleware.ts`

Checks `req.user.permissions.includes("MANAGE_SCHOOL")`. Throws `ApiError(403, "Access denied")` if absent.

### 2.4 `upload.single("file")` — bulk upload route only

**File:** `src/middlewares/upload.middleware.ts`

- **Storage:** `./uploads/{timestamp}.{ext}`
- **Allowed types:** `.xlsx`, `.csv`
- **Sets:** `req.file.path` (file path for parsing)
- **Throws:** `Error("Only .xlsx or .csv files allowed")` for other types

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `POST /teacher`

Create a teacher account with optional class/subject/section assignments, all within a database transaction.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Login username |
| `password` | string | Yes | Login password |
| `phone_number` | string | No | Phone number |
| `email` | string | No | Email address |
| `full_name` | string | No | Full name |
| `gender` | string | No | Gender |
| `preferred_language` | string | No | Language preference |
| `class_name` | string | No | Class name for auto-resolution (e.g. `"Grade 10"`) |
| `subject_name` | string | No | Subject name for auto-resolution |
| `section_name` | string | No | Section name for auto-resolution |
| `primary_subject_id` | number | No | Direct primary subject ID (takes priority over `class_name`) |
| `section_id` | number | No | Direct section ID |
| `secondary_subject_ids` | number[] | No | Additional subject IDs |
| `secondary_section_ids` | number[] | No | Sections for secondary subjects (index-aligned) |
| `experience` | number | No | Years of experience |
| `age` | number | No | Age |
| `onboarding_date` | string | No | ISO date |
| `school_tenure` | number | No | Years at school |
| `device_type` | string | No | Device type |
| `device_access` | object | No | Device access flags |
| `ppt_generation_enabled` | boolean | No | Default `false` |
| `cost_limit` | number | No | AI cost limit |
| `qualification` | string | No | Academic qualification |

#### Execution Flow

**Step 1 — Controller**
```ts
const school_id = req.user.school_id;
const { teacher, secondarySubjects } = await teacherService.createTeacher({ ...req.body, school_id });
```

**Step 2 — Service: Basic validation**
```ts
if (!username || !password)
  throw new ApiError(400, "Username and password required");
```

**Step 3 — Service: School lookup**
```ts
const school = await teacherRepository.findSchoolById(school_id);
// → AdminSchool.findOne({ where: { school_id } })
if (!school) throw new ApiError(404, "School not found");
```

**Step 4 — Service: Start transaction + load TEACHER role**
```ts
const transaction = await sequelize.transaction();
const role = await teacherRepository.findRoleByName("TEACHER", transaction);
// → AdminRole.findOne({ where: { role_name: "TEACHER" }, transaction })
```

**Step 5 — Service: Name-to-ID resolution (if `class_name` provided)**
```ts
// this.resolveClassSubjectSection({ class_name, subject_name, section_name }, school, transaction)
const classRecord = await teacherRepository.findClassByName(class_name, transaction);
// → AdminClass.findOne({ where: { class_name }, transaction })

const subjectRecord = await teacherRepository.findSubjectByParams({
  class_id, subject_name, board: school.board, language: school.language_preference,
}, transaction);
// → AdminSubject.findOne({ where: { class_id, subject_name, board, language }, transaction })

const sectionRecord = await teacherRepository.findSectionByName(class_id, section_name, transaction);
// → AdminSection.findOne({ where: { class_id, section_name }, transaction })
```

**Step 6 — Service: Create User**
```ts
const hashed = await bcrypt.hash(password, 10);
const user = await teacherRepository.createUser({
  username, full_name, password: hashed, phone_number, email,
  role_id: role.role_id, school_id, status: "Active", is_password_reset_required: true,
}, transaction);
// → INSERT INTO users (...) VALUES (...)
```

**Step 7 — Service: Create TeacherProfile**
```ts
const teacher = await teacherRepository.createTeacherProfile({
  user_id, school_id, primary_subject_id, secondary_subject_ids,
  experience, age, onboarding_date, school_tenure,
  device_type, device_access, ppt_generation_enabled, cost_limit, qualification, gender, preferred_language,
}, transaction);
// → INSERT INTO teacher_profiles (...) VALUES (...)
```

**Step 8 — Service: Build and insert assignments**
```ts
// this.buildAndInsertAssignments(teacher_id, { primary_subject_id, section_id, secondary_subject_ids, secondary_section_ids }, transaction)
const assignmentRows = [];
// Primary subject + section → 1 row
if (primary_subject_id && section_id) {
  const primarySubject = await teacherRepository.findSubjectById(primary_subject_id, transaction);
  assignmentRows.push({ teacher_id, class_id: primarySubject.class_id, section_id, class_subject_id: primary_subject_id, academic_year });
}
// Secondary subjects + sections → N rows (index-aligned)
const secSubjects = await teacherRepository.findSubjectsByIds(secondary_subject_ids, transaction);
// → AdminSubject.findAll({ where: { subject_id: secondary_subject_ids }, transaction })
for (let i = 0; i < secondary_subject_ids.length; i++) { ... }

await teacherRepository.bulkCreateAssignments(assignmentRows, transaction);
// → TeacherClassSectionSubject.bulkCreate([...])
```

**Step 9 — Service: Increment school count**
```ts
await teacherRepository.incrementSchoolTeacherCount(school_id, 1, transaction);
// → AdminSchool.increment("teacher_count", { by: 1, where: { school_id } })
await transaction.commit();
```

**Step 10 — Service: Re-fetch with includes + secondary subjects**
```ts
const created = await teacherRepository.findTeacherById(teacher.teacher_id);
// → TeacherProfile.findByPk(id, { include: [user, primarySubject, assignments] })
const secondarySubjects = await teacherRepository.findSecondarySubjects(created.secondary_subject_ids);
// → AdminSubject.findAll({ where: { subject_id: cleanIds }, include: [AdminClass] })
return { teacher: created, secondarySubjects };
```

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": {
    "teacher_id": 10,
    "user": { "username": "...", "full_name": "..." },
    "primarySubject": { "subject_id": 3, "subject_name": "Mathematics" },
    "assignments": [{ "class_id": 2, "section_id": 1, "class_subject_id": 3 }],
    "secondarySubjects": []
  },
  "message": "Teacher created successfully"
}
```

---

### 3.2 `POST /teachers/bulk`

Bulk-create teachers from an Excel or CSV file.

**Request:** `Content-Type: multipart/form-data` — field name: `file`

#### Excel Columns Expected

Same as single-create body fields: `username`, `password`, `full_name`, `phone_number`, `email`, `class_name`, `subject_name`, `section_name`, `experience`, `age`, etc.

#### Execution Flow

**Step 1 — Controller: Guard missing file**
```ts
if (!file) throw new ApiError(400, "Excel file required");
const result = await teacherService.bulkTeacherUpload(file.path, school_id);
```

**Step 2 — Service: Load school + parse Excel**
```ts
const school = await teacherRepository.findSchoolById(school_id);
const records = parseExcel(filePath);
if (!records.length) throw new ApiError(400, "Excel file is empty");
```

**Step 3 — Service: Per-row processing (inside transaction)**

For each row:
1. Validate `username`, `password`
2. Resolve `class_name` → `class_id` (if present)
3. Resolve `subject_name` → `subject_id` (using school's board + language)
4. Resolve `section_name` → `section_id`
5. `bcrypt.hash(row.password, 10)`
6. `teacherRepository.createUser({ ... })`
7. `teacherRepository.createTeacherProfile({ ..., secondary_subject_ids: null })`
8. `this.buildAndInsertAssignments(teacher_id, { primary_subject_id, section_id, ... })`
9. `createdCount++`

**Step 4 — Service: Finalize**
```ts
await teacherRepository.incrementSchoolTeacherCount(school_id, createdCount, transaction);
await transaction.commit();
fs.unlinkSync(filePath); // Clean up uploaded file
return { created: createdCount };
```

On error → `transaction.rollback()` + delete temp file.

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": { "created": 15 },
  "message": "Teachers uploaded successfully"
}
```

---

### 3.3 `GET /teachers`

Fetch all teachers for the requesting user's school, with user info, primary subject, and class assignments.

#### Execution Flow

**Step 1 — Service: Fetch all teachers with includes**
```ts
const teachers = await teacherRepository.findAllTeachers(school_id);
// → TeacherProfile.findAll({
//     where: { school_id },
//     include: [user, primarySubject → class, assignments → class/section/subject]
//   })
```

**Step 2 — Service: Resolve secondary subjects per teacher**
```ts
return Promise.all(teachers.map(async (teacher) => {
  const secondarySubjects = await teacherRepository.findSecondarySubjects(teacher.secondary_subject_ids);
  return { ...teacher.toJSON(), secondarySubjects };
}));
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{
    "teacher_id": 10,
    "user": { "username": "...", "status": "Active" },
    "primarySubject": { "subject_name": "Mathematics", "class": { "class_name": "Grade 10" } },
    "assignments": [{ "class": { "class_name": "Grade 10" }, "section": { "section_name": "A" } }],
    "secondarySubjects": []
  }],
  "message": "Teachers fetched"
}
```

---

### 3.4 `GET /teacher/:id`

Fetch a single teacher by `teacher_id`.

#### Execution Flow

```ts
const teacher = await teacherRepository.findTeacherById(id);
// → TeacherProfile.findByPk(id, { include: teacherIncludes })
if (!teacher) throw new ApiError(404, "Teacher not found");
const secondarySubjects = await teacherRepository.findSecondarySubjects(teacher.secondary_subject_ids);
return { ...teacher.toJSON(), secondarySubjects };
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "teacher_id": 10, "user": { ... }, "primarySubject": { ... }, "secondarySubjects": [...] },
  "message": "Teacher fetched"
}
```

---

### 3.5 `PUT /teacher/:id`

Update a teacher's profile and optionally replace their class/subject/section assignments.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_name` | string | No | Triggers name-based resolution for new assignment |
| `subject_name` | string | No | Used with `class_name` |
| `section_name` | string | No | Used with `class_name` |
| `primary_subject_id` | number | No | Direct subject ID override |
| `section_id` | number | No | Direct section ID override |
| `secondary_subject_ids` | number[] | No | Replace secondary subjects |
| `secondary_section_ids` | number[] | No | Sections for new secondary subjects |
| Any profile field | any | No | `experience`, `age`, `cost_limit`, `device_type`, etc. |

> **Note:** Passing any assignment-related field triggers a full **delete + re-insert** of `teacher_class_section_subjects` rows.

#### Execution Flow

**Step 1 — Service: Load teacher (raw, no includes)**
```ts
const teacher = await teacherRepository.findTeacherRaw(id);
// → TeacherProfile.findByPk(id)
if (!teacher) throw new ApiError(404, "Teacher not found");
```

**Step 2 — Service: Resolve names if provided**
```ts
if (class_name) {
  const resolved = await this.resolveClassSubjectSection({ class_name, subject_name, section_name }, school, transaction);
  finalSubjectId = resolved.resolvedSubjectId;
  finalSectionId = resolved.resolvedSectionId;
}
```

**Step 3 — Service: Update profile**
```ts
await teacherRepository.updateTeacher(teacher, { ...profileUpdates, primary_subject_id: finalSubjectId, secondary_subject_ids }, transaction);
// → UPDATE teacher_profiles SET ... WHERE teacher_id = ?
```

**Step 4 — Service: Delete + re-insert assignments (conditional)**
```ts
if (hasAssignmentData) {
  await teacherRepository.deleteAssignmentsByTeacher(id, transaction);
  // → TeacherClassSectionSubject.destroy({ where: { teacher_id } })
  await this.buildAndInsertAssignments(id, { ... }, transaction);
  // → TeacherClassSectionSubject.bulkCreate([...])
}
await transaction.commit();
```

**Step 5 — Service: Re-fetch updated teacher**
```ts
const updated = await teacherRepository.findTeacherById(id);
const secondarySubjects = await teacherRepository.findSecondarySubjects(updated.secondary_subject_ids);
return { ...updated.toJSON(), secondarySubjects };
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "teacher_id": 10, "experience": 5, "assignments": [...] },
  "message": "Teacher updated successfully"
}
```

---

### 3.6 `DELETE /teacher/:id`

Delete teacher and all related records (assignments, analytics, user) in a transaction. Decrements school `teacher_count`.

#### Execution Flow

**Step 1 — Service: Load teacher**
```ts
const teacher = await teacherRepository.findTeacherRaw(id);
if (!teacher) throw new ApiError(404, "Teacher not found");
const { school_id, user_id } = teacher;
```

**Step 2 — Repository: Cascaded delete**
```ts
await TeacherClassSectionSubject.destroy({ where: { teacher_id: id }, transaction });
await TeacherAnalytics.destroy({ where: { teacher_id: id }, transaction });
const teacher = await TeacherProfile.findByPk(id, { transaction });
await teacher?.destroy({ transaction });
await User.destroy({ where: { user_id }, transaction });
await AdminSchool.increment("teacher_count", { by: -1, where: { school_id }, transaction });
await transaction.commit();
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": null,
  "message": "Teacher deleted successfully"
}
```

---

## 4. Error Reference

| HTTP | Class | Code / Condition | Cause |
|------|-------|-----------------|-------|
| `400` | `ApiError` | — | `username` or `password` missing |
| `400` | `ApiError` | — | Excel file is empty |
| `400` | `ApiError` | — | Row missing `username` or `password` (bulk) |
| `400` | `ApiError` | — | TEACHER role not found in DB |
| `400` | `ApiError` | — | Student/Parent role not found in DB |
| `400` | `ApiError` | — | No Excel file uploaded |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `403` | `ApiError` | — | `MANAGE_SCHOOL` permission missing |
| `404` | `ApiError` | — | School not found by `school_id` |
| `404` | `ApiError` | — | Teacher not found by `id` |
| `500` | multer `Error` | — | File extension not .xlsx or .csv |

---

## 5. Complete Request Data Flow

Full chain for `POST /teacher` (single teacher creation):

```
① HTTP POST /teacher
   → activityMiddleware     (streak update async)
   → authMiddleware         (JWT → req.user)
   → requirePermission("MANAGE_SCHOOL")
   → createTeacher controller

② createTeacher()
   → teacherService.createTeacher({ ...req.body, school_id: req.user.school_id })

③ teacherService.createTeacher()
   → Validates username + password
   → teacherRepository.findSchoolById(school_id)
     → AdminSchool.findOne({ where: { school_id } })
   → sequelize.transaction()
   → teacherRepository.findRoleByName("TEACHER")
     → AdminRole.findOne({ where: { role_name: "TEACHER" } })

④ Name resolution (if class_name provided)
   → teacherRepository.findClassByName(class_name)
     → AdminClass.findOne({ where: { class_name } })
   → teacherRepository.findSubjectByParams({ class_id, subject_name, board, language })
     → AdminSubject.findOne({ where: { class_id, subject_name, board, language } })
   → teacherRepository.findSectionByName(class_id, section_name)
     → AdminSection.findOne({ where: { class_id, section_name } })

⑤ User + Profile creation
   → bcrypt.hash(password, 10)
   → teacherRepository.createUser({ ... })     → INSERT INTO users
   → teacherRepository.createTeacherProfile({}) → INSERT INTO teacher_profiles

⑥ Assignments insertion
   → teacherRepository.findSubjectById(primary_subject_id)
     → AdminSubject.findByPk(primary_subject_id)
   → teacherRepository.bulkCreateAssignments([...])
     → TeacherClassSectionSubject.bulkCreate([...])

⑦ School count increment
   → AdminSchool.increment("teacher_count", { by: 1, where: { school_id } })
   → transaction.commit()

⑧ Re-fetch with full includes
   → TeacherProfile.findByPk(teacher_id, { include: teacherIncludes })
   → AdminSubject.findAll({ where: { subject_id: secondary_ids }, include: [AdminClass] })

⑨ res.status(201).json(new ApiResponse(201, { teacher, secondarySubjects }, "Teacher created successfully"))
```

---

*Schools2AI · Teacher Module Documentation*
