# Student Module — Technical Documentation
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

All student endpoints are mounted under `/api/students` (or as configured in `index.js`).

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `POST` | `/student` | Bearer JWT | `MANAGE_SCHOOL` | Create a single student + parent pair |
| `POST` | `/students/bulk` | Bearer JWT | `MANAGE_SCHOOL` | Bulk-create students from an Excel file |
| `GET` | `/students` | Bearer JWT | `MANAGE_SCHOOL` | List all students for the school |
| `GET` | `/student/:id` | Bearer JWT | `MANAGE_SCHOOL` | Get student by `student_id` |
| `GET` | `/student/:id/profile` | Bearer JWT | `MANAGE_SCHOOL` | Get student with linked parents |
| `GET` | `/student/:id/analytics` | Bearer JWT | `MANAGE_SCHOOL` | Get student's analytics record |
| `PUT` | `/student/:id` | Bearer JWT | `MANAGE_SCHOOL` | Update student profile fields |
| `DELETE` | `/student/:id` | Bearer JWT | `MANAGE_SCHOOL` | Delete student + linked user record |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level)

Registered via `router.use(activityMiddleware)`. Fires a background streak update for every authenticated request.

**What it reads:** `req.user.user_id`
**What it attaches:** Nothing

### 2.2 `authMiddleware` — all routes (per-route)

Validates Bearer JWT → sets `req.user = { user_id, role, permissions, school_id }`.

### 2.3 `requirePermission("MANAGE_SCHOOL")` — all routes

Checks `req.user.permissions.includes("MANAGE_SCHOOL")` → 403 if missing.

### 2.4 `upload.single("file")` — bulk upload route

**File:** `src/middlewares/upload.middleware.ts`

Configured with `multer.diskStorage`:
- **Destination:** `./uploads/`
- **Filename:** `{timestamp}.{original_ext}`
- **Filter:** Only `.xlsx` or `.csv` files allowed

Attaches parsed file to `req.file = { fieldname, originalname, path, mimetype, size }`.
Throws `Error("Only .xlsx or .csv files allowed")` for invalid types.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `POST /student`

Create a single student account along with a linked parent account inside a database transaction.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `student_username` | string | Yes | Login username for student |
| `student_password` | string | Yes | Login password for student |
| `student_phone` | string | No | Student phone number |
| `student_email` | string | No | Student email |
| `student_full_name` | string | No | Student's full name |
| `parent_username` | string | Yes | Login username for parent |
| `parent_password` | string | Yes | Login password for parent |
| `parent_phone` | string | No | Parent phone number |
| `parent_email` | string | No | Parent email |
| `parent_full_name` | string | No | Parent's full name |
| `parent_name` | string | No | Parent's display name |
| `relation` | string | No | `father`, `mother`, or `guardian` |
| `class_id` | number | No | Class to enroll the student |
| `section_id` | number | No | Section within the class |
| `roll_number` | string | No | Roll number |
| `academic_year` | string | No | Academic year string |
| `preferred_language` | string | No | Preferred language |
| `onboarding_date` | string | No | ISO date string |
| `cost_limit` | number | No | AI cost limit |
| `dob` | string | No | Date of birth |
| `gender` | string | No | `male`, `female`, or `other` |
| `analytics_enabled` | boolean | No | Default `false` |

#### Execution Flow

**Step 1 — Controller**
```ts
const school_id = req.user.school_id;
const student = await studentService.createStudent({ ...req.body, school_id });
```

**Step 2 — Service: Field validation**
```ts
if (!student_username || !student_password || !parent_username || !parent_password)
  throw new ApiError(400, "Required fields missing");
```

**Step 3 — Service: School lookup**
```ts
const school = await studentRepository.findSchoolById(school_id);
// → AdminSchool.findByPk(school_id)
if (!school) throw new ApiError(404, "School not found");
```

**Step 4 — Service: Enum validation**
```ts
if (relation && !["father","mother","guardian"].includes(relation.toLowerCase()))
  throw new ApiError(400, "Invalid relation");
if (gender && !["male","female","other"].includes(gender.toLowerCase()))
  throw new ApiError(400, "Invalid gender");
```

**Step 5 — Service: Start transaction**
```ts
const transaction = await sequelize.transaction();
```

**Step 6 — Service: Resolve roles**
```ts
const [studentRole, parentRole] = await Promise.all([
  studentRepository.findRoleByName("STUDENT", transaction),
  // → AdminRole.findOne({ where: { role_name: "STUDENT" }, transaction })
  studentRepository.findRoleByName("PARENT", transaction),
]);
```

**Step 7 — Service: Create parent user + profile**
```ts
const parentHashed = await bcrypt.hash(parent_password, 10);
const parentUser = await studentRepository.createUser({
  username, password: parentHashed, role_id: parentRole.role_id,
  school_id, status: "Active", is_password_reset_required: true,
}, transaction);
// → INSERT INTO users (...) VALUES (...)

const parent = await studentRepository.createParentProfile({
  user_id: parentUser.user_id, school_id, parent_name, relation,
}, transaction);
// → INSERT INTO parent_profiles (...) VALUES (...)
```

**Step 8 — Service: Create student user + profile**
```ts
const studentHashed = await bcrypt.hash(student_password, 10);
const studentUser = await studentRepository.createUser({ ..., role_id: studentRole.role_id }, transaction);
const student = await studentRepository.createStudentProfile({
  user_id: studentUser.user_id, school_id, preferred_language, dob, gender, analytics_enabled,
}, transaction);
// → INSERT INTO student_profiles (...) VALUES (...)
```

**Step 9 — Service: Link parent to student**
```ts
await studentRepository.createParentStudentMap(
  { parent_id: parent.parent_id, student_id: student.student_id },
  transaction
);
// → INSERT INTO parent_student_maps (parent_id, student_id) VALUES (?, ?)
```

**Step 10 — Service: Class section + school count**
```ts
await studentRepository.createClassSection({ student_id, class_id, section_id, roll_number, status: "active" }, transaction);
// → INSERT INTO student_class_sections (...) VALUES (...)

await studentRepository.incrementSchoolStudentCount(school_id, 1, transaction);
// → UPDATE admin_schools SET student_count = student_count + 1 WHERE school_id = ?

await transaction.commit();
```

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": { "student_id": 42, "user_id": 100, "school_id": 1, ... },
  "message": "Student created successfully"
}
```

---

### 3.2 `POST /students/bulk`

Bulk-create students (and their parents) by parsing an Excel/CSV file.

**Request:** `Content-Type: multipart/form-data` — field name: `file` (.xlsx or .csv)

#### Excel Columns Expected

Same columns as the single-create body fields, one row per student.
Additional columns: `class_name` (string) and `section_name` (string) for automatic ID resolution.

#### Execution Flow

**Step 1 — Controller: Guard missing file**
```ts
if (!file) throw new ApiError(400, "Excel file required");
const result = await studentService.bulkStudentUpload(file.path, school_id);
```

**Step 2 — Service: Parse Excel**
```ts
const records = parseExcel(filePath);
// → Uses xlsx/csv-parse to return array of row objects
if (!records.length) throw new ApiError(400, "Excel file is empty");
```

**Step 3 — Service: Open transaction, load roles**
```ts
const transaction = await sequelize.transaction();
const [studentRole, parentRole] = await Promise.all([...]);
```

**Step 4 — Service: Per-row loop**

For each row:
1. Validate required fields (`student_username`, `student_password`, `parent_username`, `parent_password`)
2. Validate `relation` and `gender` enums
3. Resolve `class_name` → `class_id` via `AdminClass.findOne({ where: { class_name }, transaction })`
4. Resolve `section_name` → `section_id` via `AdminSection.findOne({ where: { class_id, section_name }, transaction })`
5. Create parent user → parent profile → student user → student profile → parent-student map → class section
6. `createdCount++`

**Step 5 — Service: Increment school count + cleanup**
```ts
await studentRepository.incrementSchoolStudentCount(school_id, createdCount, transaction);
await transaction.commit();
fs.unlinkSync(filePath); // Delete temp upload file
```

On error → `transaction.rollback()` + `fs.unlinkSync(filePath)`

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": { "created": 25 },
  "message": "Students uploaded successfully"
}
```

---

### 3.3 `GET /students`

Get all students for the requesting user's school.

#### Execution Flow

**Step 1 — Controller**
```ts
const school_id = req.user.school_id;
const students = await studentService.getAllStudents(school_id);
```

**Step 2 — Repository**
```ts
StudentProfile.findAll({
  where: { school_id },
  include: [
    { model: User, as: "user", attributes: ["user_id","username","full_name","email","phone_number","status","avatar"] },
    { model: StudentClassSection, as: "classSection",
      include: [
        { model: AdminClass, as: "class" },
        { model: AdminSection, as: "section" }
      ]
    }
  ]
});
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{
    "student_id": 1,
    "user": { "user_id": 10, "username": "stu1", "full_name": "...", "status": "Active" },
    "classSection": { "class_id": 2, "class": { "class_name": "Grade 10" }, "section": null }
  }],
  "message": "Students fetched"
}
```

---

### 3.4 `GET /student/:id`

Get a single student by primary key.

#### Execution Flow

**Step 1 — Controller**
```ts
const { id } = req.params;
const student = await studentService.getStudentById(id);
```

**Step 2 — Service: Guard not found**
```ts
const student = await studentRepository.findStudentById(id);
// → StudentProfile.findByPk(id, { include: [...user, ...classSection] })
if (!student) throw new ApiError(404, "Student not found");
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "student_id": 1, "user": { ... }, "classSection": { ... } },
  "message": "Student fetched"
}
```

---

### 3.5 `GET /student/:id/profile`

Get full student profile including linked parent records.

#### Repository Query

```ts
StudentProfile.findByPk(id, {
  include: [
    { model: User, as: "user" },
    { model: StudentClassSection, as: "classSection",
      include: [AdminClass, AdminSection] },
    { model: ParentProfile, as: "parents",
      through: { attributes: [] },    // Hides join table columns
      include: [{ model: User, as: "user" }] }
  ]
});
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {
    "student_id": 1, "user": { ... }, "classSection": { ... },
    "parents": [{ "parent_id": 5, "relation": "father", "user": { "full_name": "..." } }]
  },
  "message": "Student profile fetched"
}
```

---

### 3.6 `GET /student/:id/analytics`

Get student's learning analytics record.

#### Execution Flow

**Step 1 — Service: Confirm student exists**
```ts
const student = await studentRepository.findStudentById(id);
if (!student) throw new ApiError(404, "Student not found");
```

**Step 2 — Repository: Find analytics**
```ts
return studentRepository.findStudentAnalytics(id);
// → StudentAnalytics.findOne({ where: { student_id } })
// Returns null if no analytics record exists
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "student_id": 1, "total_sessions": 42, "avg_score": 78.5, ... } ,
  "message": "Student analytics fetched"
}
```

---

### 3.7 `PUT /student/:id`

Update student profile fields.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gender` | string | No | `male`, `female`, or `other` (normalized to lowercase) |
| `status` | string | No | Profile status |
| Any other field | any | No | Any field on `StudentProfile` |

> **Note:** `gender` is normalized to lowercase before saving. `status` can be passed separately.

#### Execution Flow

**Step 1 — Service: Find student**
```ts
const student = await studentRepository.findStudentById(id);
if (!student) throw new ApiError(404, "Student not found");
```

**Step 2 — Service: Validate gender**
```ts
const normalizedGender = gender?.toLowerCase() || null;
if (normalizedGender && !["male","female","other"].includes(normalizedGender))
  throw new ApiError(400, "Invalid gender");
```

**Step 3 — Service: Update**
```ts
await student.update({ ...rest, ...(normalizedGender && { gender: normalizedGender }) });
// → UPDATE student_profiles SET ... WHERE student_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "student_id": 1, "gender": "male", ... },
  "message": "Student updated successfully"
}
```

---

### 3.8 `DELETE /student/:id`

Delete student, their linked user record, class sections, parent-student map, and analytics — all in a transaction. Also decrements the school's `student_count`.

#### Execution Flow

**Step 1 — Service: Find student**
```ts
const student = await studentRepository.findStudentById(id);
if (!student) throw new ApiError(404, "Student not found");
const { school_id, user_id } = student;
```

**Step 2 — Repository: Cascaded delete in transaction**
```ts
await StudentClassSection.destroy({ where: { student_id: id }, transaction });
await ParentStudentMap.destroy(   { where: { student_id: id }, transaction });
await StudentAnalytics.destroy(   { where: { student_id: id }, transaction });
const student = await StudentProfile.findByPk(id, { transaction });
await student?.destroy({ transaction });
await User.destroy({ where: { user_id }, transaction });
await AdminSchool.increment("student_count", { by: -1, where: { school_id }, transaction });
await transaction.commit();
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": null,
  "message": "Student deleted successfully"
}
```

---

## 4. Error Reference

| HTTP | Class | Code / Condition | Cause |
|------|-------|-----------------|-------|
| `400` | `ApiError` | — | Missing required fields (username/password) |
| `400` | `ApiError` | — | Invalid `relation` value |
| `400` | `ApiError` | — | Invalid `gender` value |
| `400` | `ApiError` | — | No Excel file uploaded |
| `400` | `ApiError` | — | Excel file is empty |
| `400` | `ApiError` | — | Per-row missing required field (bulk) |
| `400` | `ApiError` | — | Per-row invalid relation/gender (bulk) |
| `400` | `ApiError` | — | Student or Parent role not in DB |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `403` | `ApiError` | — | `MANAGE_SCHOOL` permission missing |
| `404` | `ApiError` | — | School not found by school_id |
| `404` | `ApiError` | — | Student not found by id |
| `500` | multer `Error` | — | File extension is not .xlsx or .csv |

---

## 5. Complete Request Data Flow

Full chain for `POST /student` (single student creation):

```
① HTTP POST /student
   → activityMiddleware    (fires streak update async)
   → authMiddleware        (JWT → req.user)
   → requirePermission("MANAGE_SCHOOL")
   → createStudent controller

② createStudent()
   → studentService.createStudent({ ...req.body, school_id: req.user.school_id })

③ studentService.createStudent()
   → Validates required fields
   → studentRepository.findSchoolById(school_id)
     → AdminSchool.findByPk(school_id)
   → Validates relation, gender enums
   → sequelize.transaction()

④ Inside transaction:
   → studentRepository.findRoleByName("STUDENT")  → AdminRole.findOne
   → studentRepository.findRoleByName("PARENT")   → AdminRole.findOne
   → bcrypt.hash(parent_password, 10)
   → studentRepository.createUser(parentData)     → User.create
   → studentRepository.createParentProfile(...)   → ParentProfile.create
   → bcrypt.hash(student_password, 10)
   → studentRepository.createUser(studentData)    → User.create
   → studentRepository.createStudentProfile(...)  → StudentProfile.create
   → studentRepository.createParentStudentMap(...)→ ParentStudentMap.create
   → studentRepository.createClassSection(...)    → StudentClassSection.create
   → studentRepository.incrementSchoolStudentCount()
     → AdminSchool.increment("student_count", { by: 1, where: { school_id } })

⑤ transaction.commit()

⑥ res.status(201).json(new ApiResponse(201, student, "Student created successfully"))
```

---

*Schools2AI · Student Module Documentation*
