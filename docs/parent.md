# Parent Module — Technical Documentation
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

All parent endpoints are mounted under the prefix configured in `index.js`.

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `GET` | `/parents` | Bearer JWT | `MANAGE_SCHOOL` | List all parents for the school |
| `GET` | `/parent/:id` | Bearer JWT | `MANAGE_SCHOOL` | Get a parent with their linked students |
| `GET` | `/parent/:id/profile` | Bearer JWT | `MANAGE_SCHOOL` | Get full parent profile with students + class info |
| `PUT` | `/parent/:id` | Bearer JWT | `MANAGE_SCHOOL` | Update parent profile fields |
| `DELETE` | `/parent/:id` | Bearer JWT | `MANAGE_SCHOOL` | Delete parent + user record in a transaction |

> **Note:** `POST /parent` (create) exists in the controller but is **not registered** in `parent.routes.js`. Parent creation is handled by the Student module during student creation.

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level)

**File:** `src/middlewares/activity.middleware.ts`

Registered via `router.use(activityMiddleware)`. Fires a background streak update for authenticated requests.

**Reads:** `req.user?.user_id`  
**Attaches:** Nothing (purely a side-effect)

### 2.2 `authMiddleware` — all routes (per-route)

**File:** `src/middlewares/auth.middleware.ts`

Validates Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

- Throws `ApiError(401, "Access token missing")` if header is absent
- Throws `ApiError(401, "Invalid or expired token")` if JWT verification fails

### 2.3 `requirePermission("MANAGE_SCHOOL")` — all routes

**File:** `src/middlewares/permission.middleware.ts`

Checks `req.user.permissions.includes("MANAGE_SCHOOL")`.
Throws `ApiError(403, "Access denied")` if the permission is absent.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `GET /parents`

Fetch all parent profiles for the requesting admin's school, including linked user info and linked student list.

#### Execution Flow

**Step 1 — Controller**
```ts
const school_id = req.user.school_id;
const parents = await parentService.getAllParents(school_id);
```

**Step 2 — Service → Repository**
```ts
parentRepository.findAllParents(school_id);
```

**Step 3 — Repository query**
```ts
ParentProfile.findAll({
  where: { school_id },
  include: [
    {
      model: User, as: "user",
      attributes: ["user_id","username","full_name","phone_number","email","status","avatar"],
    },
    {
      model: StudentProfile, as: "students",
      attributes: ["student_id","preferred_language","dob","gender","onboarding_date"],
      through: { attributes: [] }, // Hides parent_student_map join columns
      include: [{
        model: User, as: "user",
        attributes: ["user_id","username","full_name","phone_number","email","status","avatar"],
      }],
    },
  ],
});
// → SELECT parent_profiles.*, users.*, student_profiles.*, ...
//   FROM parent_profiles
//   LEFT JOIN users ON parent_profiles.user_id = users.user_id
//   LEFT JOIN parent_student_maps ON parent_profiles.parent_id = parent_student_maps.parent_id
//   LEFT JOIN student_profiles ON parent_student_maps.student_id = student_profiles.student_id
//   WHERE parent_profiles.school_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{
    "parent_id": 5,
    "parent_name": "John Doe",
    "relation": "father",
    "user": { "user_id": 20, "username": "john_doe", "status": "Active" },
    "students": [{ "student_id": 1, "user": { "full_name": "Jane Doe" } }]
  }],
  "message": "Parents fetched"
}
```

---

### 3.2 `GET /parent/:id`

Get a single parent by `parent_id` with their linked user and student list.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | `parent_id` (primary key of `parent_profiles`) |

#### Execution Flow

**Step 1 — Controller**
```ts
const { id } = req.params;
const parent = await parentService.getParentById(id);
```

**Step 2 — Service: Guard not found**
```ts
const parent = await parentRepository.findParentById(id);
// → ParentProfile.findByPk(id, { include: [user, students → user] })
if (!parent) throw new ApiError(404, "Parent not found");
return parent;
```

**Step 3 — Repository query**
```ts
ParentProfile.findByPk(id, {
  include: [
    { model: User, as: "user", attributes: [...] },
    {
      model: StudentProfile, as: "students",
      through: { attributes: [] },
      include: [{ model: User, as: "user", attributes: [...] }],
    },
  ]
});
// → SELECT ... FROM parent_profiles WHERE parent_id = ?
//   LEFT JOIN users, parent_student_maps, student_profiles
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {
    "parent_id": 5,
    "relation": "father",
    "user": { "username": "john_doe", "email": "john@school.com" },
    "students": [{ "student_id": 1, "user": { "full_name": "Jane Doe" } }]
  },
  "message": "Parent fetched"
}
```

---

### 3.3 `GET /parent/:id/profile`

Get the full parent profile, including linked students with their **class and section** information.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | `parent_id` |

#### Execution Flow

**Step 1 — Controller**
```ts
const { id } = req.params;
const parent = await parentService.getParentProfile(id);
```

**Step 2 — Service**
```ts
const parent = await parentRepository.findParentProfile(id);
if (!parent) throw new ApiError(404, "Parent not found");
```

**Step 3 — Repository query** (more detailed than `findParentById`)
```ts
ParentProfile.findByPk(id, {
  include: [
    { model: User, as: "user", attributes: ["user_id","username","full_name","phone_number","email","status","avatar"] },
    {
      model: StudentProfile, as: "students",
      attributes: ["student_id","dob","gender","preferred_language","onboarding_date","analytics_enabled"],
      through: { attributes: [] },
      include: [
        { model: User, as: "user", attributes: ["user_id","username","full_name","email","phone_number","avatar","status"] },
        {
          model: StudentClassSection, as: "classSection",
          attributes: ["class_id","section_id","roll_number","academic_year","status"],
          include: [
            { model: AdminClass,   as: "class",   attributes: ["class_id","class_name"] },
            { model: AdminSection, as: "section", attributes: ["section_id","section_name"] },
          ]
        }
      ],
    },
  ]
});
// → Multi-join query loading parent → students → classSection → class/section
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {
    "parent_id": 5,
    "user": { "full_name": "John Doe", "email": "john@school.com" },
    "students": [{
      "student_id": 1,
      "dob": "2010-05-15",
      "gender": "female",
      "user": { "full_name": "Jane Doe" },
      "classSection": {
        "roll_number": "12",
        "class": { "class_name": "Grade 8" },
        "section": { "section_name": "B" }
      }
    }]
  },
  "message": "Parent profile fetched"
}
```

---

### 3.4 `PUT /parent/:id`

Update parent profile fields. Cannot change `user_id` or `school_id` through this endpoint.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | `parent_id` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent_name` | string | No | Display name of the parent |
| `relation` | string | No | Must be `father`, `mother`, or `guardian` |
| `user_id` | any | No | Ignored (stripped in service layer) |
| `school_id` | any | No | Ignored (stripped in service layer) |
| Any other field | any | No | Any other `ParentProfile` field |

#### Execution Flow

**Step 1 — Controller**
```ts
const { id } = req.params;
const parent = await parentService.updateParent(id, req.body);
```

**Step 2 — Service: Find parent**
```ts
const parent = await parentRepository.findParentById(id);
if (!parent) throw new ApiError(404, "Parent not found");
```

**Step 3 — Service: Strip protected fields**
```ts
const { user_id, school_id, ...allowedUpdates } = body;
// user_id and school_id are explicitly excluded
```

**Step 4 — Service: Validate relation**
```ts
if (allowedUpdates.relation && !["father","mother","guardian"].includes(allowedUpdates.relation))
  throw new ApiError(400, `Invalid relation. Must be one of: father, mother, guardian`);
```

**Step 5 — Repository: Update**
```ts
return parentRepository.updateParent(parent, allowedUpdates);
// → parent.update(allowedUpdates)
// → UPDATE parent_profiles SET ... WHERE parent_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "parent_id": 5, "parent_name": "John Smith", "relation": "father" },
  "message": "Parent updated successfully"
}
```

---

### 3.5 `DELETE /parent/:id`

Delete a parent and their user record atomically. Also removes `parent_student_map` rows to clean up relationships.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | `parent_id` |

#### Execution Flow

**Step 1 — Service: Load parent**
```ts
const parent = await parentRepository.findParentById(id);
if (!parent) throw new ApiError(404, "Parent not found");
const user_id = parent.user_id;
```

**Step 2 — Repository: Cascaded delete in transaction**
```ts
const transaction = await sequelize.transaction();
try {
  const parent = await ParentProfile.findByPk(id, { transaction });
  if (!parent) throw new Error("Parent not found");

  await ParentStudentMap.destroy({ where: { parent_id: id }, transaction });
  // → DELETE FROM parent_student_maps WHERE parent_id = ?

  await parent.destroy({ transaction });
  // → DELETE FROM parent_profiles WHERE parent_id = ?

  await User.destroy({ where: { user_id }, transaction });
  // → DELETE FROM users WHERE user_id = ?

  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": null,
  "message": "Parent deleted successfully"
}
```

---

## 4. Error Reference

| HTTP | Class | Code / Condition | Cause |
|------|-------|-----------------|-------|
| `400` | `ApiError` | — | `username` or `password` missing (createParent — unused route) |
| `400` | `ApiError` | — | Invalid `relation` value (not father/mother/guardian) |
| `400` | `ApiError` | — | `PARENT` role not found in DB (createParent) |
| `401` | `ApiError` | — | Missing or invalid Bearer JWT |
| `403` | `ApiError` | — | `MANAGE_SCHOOL` permission missing |
| `404` | `ApiError` | — | Parent not found by `id` |
| `500` | `Error` | — | Parent not found inside delete transaction (race condition) |

---

## 5. Complete Request Data Flow

Full chain for `GET /parent/:id/profile` (most complex read in this module):

```
① HTTP GET /parent/5/profile
   → activityMiddleware    (fires streak update async for req.user.user_id)
   → authMiddleware        (JWT → req.user = { user_id, role, school_id, permissions })
   → requirePermission("MANAGE_SCHOOL")
     → checks req.user.permissions.includes("MANAGE_SCHOOL")
   → getParentProfile controller

② getParentProfile()
   → const { id } = req.params  // "5"
   → parentService.getParentProfile("5")

③ parentService.getParentProfile()
   → parentRepository.findParentProfile("5")

④ parentRepository.findParentProfile()
   → ParentProfile.findByPk("5", {
       include: [
         User (as "user"),
         StudentProfile (as "students", through: ParentStudentMap) → [
           User (as "user"),
           StudentClassSection (as "classSection") → [
             AdminClass (as "class"),
             AdminSection (as "section")
           ]
         ]
       ]
     })
   → Sequelize generates multi-table JOIN SQL
   → MySQL returns parent row + joined student rows + class/section rows

⑤ Service: guards null
   → if (!parent) throw new ApiError(404, "Parent not found")

⑥ Controller: wraps result
   → res.status(200).json(new ApiResponse(200, parent, "Parent profile fetched"))
   → { statusCode: 200, data: { parent_id, user, students: [{ classSection: { class, section } }] } }
```

---

*Schools2AI · Parent Module Documentation*
