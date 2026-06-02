# Admin Module — Technical Documentation
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

All admin endpoints are mounted under the prefix `/api/admin`.

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `PUT` | `/api/admin/school` | Bearer JWT | `MANAGE_SCHOOL` | Update school details |
| `PUT` | `/api/admin/edit-profile` | Bearer JWT | `MANAGE_SCHOOL` | Update a user's profile (role-aware) |
| `GET` | `/api/admin/roles` | Bearer JWT | `MANAGE_SCHOOL` | List all roles |
| `POST` | `/api/admin/roles` | Bearer JWT | `MANAGE_SCHOOL` | Create a new role |
| `GET` | `/api/admin/roles-with-permissions` | Bearer JWT | `MANAGE_ROLES` | List all roles with their permissions |
| `GET` | `/api/admin/permissions` | Bearer JWT | `MANAGE_SCHOOL` | List all permissions |
| `POST` | `/api/admin/permissions` | Bearer JWT | `MANAGE_SCHOOL` | Create a new permission |
| `POST` | `/api/admin/roles/assign-permissions` | Bearer JWT | `MANAGE_SCHOOL` | Assign permissions to a role (replaces existing) |
| `PUT` | `/api/admin/users/change-role` | Bearer JWT | `ASSIGN_ROLES` | Change a user's role |
| `PUT` | `/api/admin/users/change-status` | Bearer JWT | `MANAGE_SCHOOL` | Activate or deactivate a user |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global, all routes

**File:** `src/middlewares/activity.middleware.ts`

Registered via `router.use(activityMiddleware)` — runs before every handler.

**Step 1 — Read `user_id` from `req.user`**
```ts
const user_id = req.user?.user_id;
if (!user_id) return next(); // Public routes — skip
```

**Step 2 — Build cache key**
```ts
const today = todayIST(); // "YYYY-MM-DD" in IST
const cacheKey = `${user_id}:${today}`;
```

**Step 3 — In-memory cache check**
```ts
if (_seenToday.has(cacheKey)) return next(); // Already processed today
```

**Step 4 — Fire-and-forget streak update**
```ts
_updateStreakBackground(user_id, today, cacheKey).catch(() => {});
return next(); // Request continues immediately — DB write is async
```

**What it attaches to `req`:** Nothing — purely a side-effect middleware.

---

### 2.2 `authMiddleware` — all routes (per-route)

**File:** `src/middlewares/auth.middleware.ts`

**Step 1 — Read Authorization header**
```ts
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith("Bearer "))
  throw new ApiError(401, "Access token missing");
```

**Step 2 — Extract and verify JWT**
```ts
const token = authHeader.split(" ")[1];
const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as UserTokenPayload;
```
On failure → `ApiError(401, "Invalid or expired token")`.

**Step 3 — Attach to request**
```ts
req.user = decoded; // { user_id, role, permissions[], school_id, iat, exp }
next();
```

---

### 2.3 `requirePermission(permission)` — per-route

**File:** `src/middlewares/permission.middleware.ts`

A middleware factory that returns a handler checking a specific permission key.

**Step 1 — Read permissions from token**
```ts
const userPermissions: string[] = req.user?.permissions ?? [];
```

**Step 2 — Check membership**
```ts
if (!userPermissions.includes(permission))
  throw new ApiError(403, "Access denied");
next();
```

| Passes when | Throws when |
|-------------|-------------|
| `req.user.permissions` contains the required key | Key not in array → `403 Access denied` |

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `PUT /api/admin/school`

Update the school record belonging to the requesting user's `school_id`.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Any school field | any | Yes (at least one) | Fields to update on `AdminSchool` (e.g. `school_name`, `board`, `language_preference`) |

#### Execution Flow

**Step 1 — Controller extracts `school_id`**
```ts
const { school_id } = req.user; // from JWT
```

**Step 2 — Calls service**
```ts
const school = await AdminService.updateSchoolService(school_id, req.body);
```

**Step 3 — Service: find school**
```ts
const school = await AdminRepo.findSchoolById(school_id);
// → AdminSchool.findOne({ where: { school_id } })
if (!school) throw new NotFoundError("School", String(school_id)); // 404
```

**Step 4 — Service: update record**
```ts
return school.update(updates);
// → Sequelize UPDATE admin_schools SET ... WHERE school_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "school_id": 1, "school_name": "...", "board": "CBSE", ... },
  "message": "School updated successfully"
}
```

---

### 3.2 `PUT /api/admin/edit-profile`

Update a user's profile fields, with role-aware branching for STUDENT / TEACHER / PARENT / ADMIN.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | number | Yes | Target user's ID |
| `full_name` | string | No | New full name |
| `email` | string | No | New email |
| `phone_number` | string | No | New phone number |
| `status` | string | No | User table status |
| `profile_status` | string | No | Profile table status |
| `preferred_language` | string | No | Student only |
| `dob` | string | No | Student only |
| `gender` | string | No | Student only |
| `analytics_enabled` | boolean | No | Student only |
| `experience` | number | No | Teacher only |
| `age` | number | No | Teacher only |
| `device_type` | string | No | Teacher only |
| `cost_limit` | number | No | Teacher only |
| `parent_name` | string | No | Parent only |
| `relation` | string | No | Parent only |

#### Execution Flow

**Step 1 — Controller**
```ts
const { role } = req.user;  // Requestor's role from JWT
const { user_id, ...updates } = req.body;
const updatedData = await AdminService.editProfileService(role, user_id, updates);
```

**Step 2 — Service: role gate**
```ts
if (!["ADMIN", "SUBADMIN"].includes(requestorRole))
  throw new AuthenticationError("Access denied"); // 401
```

**Step 3 — Service: validate user_id**
```ts
if (!user_id) throw new ValidationError([{ field: "user_id", code: "REQUIRED" }]);
```

**Step 4 — Service: load user + role**
```ts
const user = await AdminRepo.findUserById(user_id);
// → User.findOne({ where: { user_id } })
if (!user) throw new NotFoundError("User", String(user_id));

const roleData = await AdminRepo.findRoleById(user.role_id);
// → AdminRole.findOne({ where: { role_id } })
const userRole = roleData?.role_name;
```

**Step 5 — Service: update User table (always)**
```ts
await user.update({ full_name, email, phone_number, status });
// → UPDATE users SET ... WHERE user_id = ?
```

**Step 6 — Service: role-specific profile update**

| Target Role | Model | Additional Fields Updated |
|-------------|-------|--------------------------|
| `ADMIN` / `SUBADMIN` | None | User table only |
| `STUDENT` | `StudentProfile` | `preferred_language`, `dob`, `gender`, `analytics_enabled`, `status` |
| `TEACHER` | `TeacherProfile` | `experience`, `age`, `device_type`, `cost_limit`, `status` |
| `PARENT` | `ParentProfile` | `parent_name`, `relation`, `status` |

```ts
// Example for STUDENT:
const student = await AdminRepo.findStudentByUserId(user_id);
// → StudentProfile.findOne({ where: { user_id } })
if (!student) throw new NotFoundError("Student", String(user_id));
return student.update({ preferred_language, dob, gender, analytics_enabled, status: profile_status });
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { /* updated profile record */ },
  "message": "Profile updated successfully"
}
```

---

### 3.3 `GET /api/admin/roles`

Fetch all roles.

#### Execution Flow

**Step 1 — Controller**
```ts
const roles = await AdminService.getAllRolesService();
```

**Step 2 — Repository**
```ts
AdminRole.findAll();
// → SELECT * FROM admin_roles
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{ "role_id": 1, "role_name": "ADMIN", "description": "..." }, ...],
  "message": "Roles fetched successfully"
}
```

---

### 3.4 `POST /api/admin/roles`

Create a new role.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role_name` | string | Yes | Unique role identifier |
| `description` | string | No | Human-readable description |

#### Execution Flow

**Step 1 — Controller**
```ts
const { role_name, description } = req.body;
const role = await AdminService.createRoleService(role_name, description);
```

**Step 2 — Service: validate**
```ts
if (!role_name)
  throw new ValidationError([{ field: "role_name", code: "REQUIRED" }]);
```

**Step 3 — Repository**
```ts
AdminRole.create({ role_name, description });
// → INSERT INTO admin_roles (role_name, description) VALUES (?, ?)
```

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": { "role_id": 5, "role_name": "NEW_ROLE", "description": "..." },
  "message": "Role created successfully"
}
```

---

### 3.5 `GET /api/admin/roles-with-permissions`

Fetch all roles with their associated permissions (requires `MANAGE_ROLES` permission).

#### Execution Flow

**Repository query:**
```ts
AdminRole.findAll({
  include: [{
    model: AdminPermission,
    as: "permissions",
    attributes: ["permission_id", "permission_key"],
  }]
});
// → SELECT admin_roles.*, admin_permissions.* FROM admin_roles
//   LEFT JOIN admin_role_permissions ON ...
//   LEFT JOIN admin_permissions ON ...
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{ "role_id": 1, "role_name": "ADMIN", "permissions": [{ "permission_id": 1, "permission_key": "MANAGE_SCHOOL" }] }],
  "message": "Roles with permissions fetched successfully"
}
```

---

### 3.6 `GET /api/admin/permissions`

Fetch all available permission keys.

**Repository:**
```ts
AdminPermission.findAll();
// → SELECT * FROM admin_permissions
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": [{ "permission_id": 1, "permission_key": "MANAGE_SCHOOL", "description": "..." }],
  "message": "Permissions fetched successfully"
}
```

---

### 3.7 `POST /api/admin/permissions`

Create a new permission key.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `permission_key` | string | Yes | Unique key (e.g. `MANAGE_SCHOOL`) |
| `description` | string | No | Human-readable description |

#### Execution Flow

**Step 1 — Service: validate**
```ts
if (!permission_key)
  throw new ValidationError([{ field: "permission_key", code: "REQUIRED" }]);
```

**Step 2 — Repository**
```ts
AdminPermission.create({ permission_key, description });
// → INSERT INTO admin_permissions (permission_key, description) VALUES (?, ?)
```

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": { "permission_id": 10, "permission_key": "NEW_PERM" },
  "message": "Permission created successfully"
}
```

---

### 3.8 `POST /api/admin/roles/assign-permissions`

Assign a set of permissions to a role. This is a **replace** operation — all existing assignments for the role are deleted first.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role_id` | number | Yes | ID of the role to update |
| `permission_ids` | number[] | Yes | Array of permission IDs to assign |

#### Execution Flow

**Step 1 — Service: validate**
```ts
if (!role_id || !permission_ids?.length)
  throw new ValidationError([...]);
```

**Step 2 — Repository: delete existing**
```ts
AdminRolePermission.destroy({ where: { role_id } });
// → DELETE FROM admin_role_permissions WHERE role_id = ?
```

**Step 3 — Repository: bulk insert**
```ts
AdminRolePermission.bulkCreate(
  permission_ids.map((permission_id) => ({ role_id, permission_id }))
);
// → INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ...
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {},
  "message": "Permissions assigned to role successfully"
}
```

---

### 3.9 `PUT /api/admin/users/change-role`

Change a user's `role_id` (requires `ASSIGN_ROLES` permission).

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | number | Yes | Target user |
| `role_id` | number | Yes | New role to assign |

#### Execution Flow

**Step 1 — Service: validate**
```ts
if (!user_id || !role_id)
  throw new ValidationError([...]);
```

**Step 2 — Service: confirm user exists**
```ts
const user = await AdminRepo.findUserById(user_id);
// → User.findOne({ where: { user_id } })
if (!user) throw new NotFoundError("User", String(user_id));
```

**Step 3 — Repository: update**
```ts
user.role_id = role_id;
await user.save();
// → UPDATE users SET role_id = ? WHERE user_id = ?
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "user_id": 42, "role_id": 3, ... },
  "message": "User role updated successfully"
}
```

---

### 3.10 `PUT /api/admin/users/change-status`

Change a user's status and mirror it to their role-specific profile table (requires `ADMIN` role).

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | number | Yes | Target user |
| `status` | string | Yes | New status value (e.g. `Active`, `Inactive`) |

#### Execution Flow

**Step 1 — Service: ADMIN-only gate**
```ts
if (!["ADMIN"].includes(requestorRole))
  throw new AuthenticationError("Access denied");
```

**Step 2 — Service: validate + load user + role**
```ts
const user = await AdminRepo.findUserById(user_id);
const roleData = await AdminRepo.findRoleById(user.role_id);
const userRole = roleData?.role_name;
```

**Step 3 — Update user table**
```ts
await user.update({ status });
// → UPDATE users SET status = ? WHERE user_id = ?
```

**Step 4 — Mirror to profile table**

| User Role | Profile Table | Operation |
|-----------|---------------|-----------|
| `STUDENT` | `student_profiles` | `UPDATE student_profiles SET status = ? WHERE user_id = ?` |
| `TEACHER` | `teacher_profiles` | `UPDATE teacher_profiles SET status = ? WHERE user_id = ?` |
| `PARENT` | `parent_profiles` | `UPDATE parent_profiles SET status = ? WHERE user_id = ?` |
| `ADMIN` / `SUBADMIN` | — | User table only |

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {},
  "message": "User status updated successfully"
}
```

---

## 4. Error Reference

| HTTP | Class | Code / Condition | Cause |
|------|-------|-----------------|-------|
| `401` | `ApiError` | — | Missing or invalid Bearer token |
| `401` | `AuthenticationError` | — | Requestor role is not `ADMIN` or `SUBADMIN` |
| `403` | `ApiError` | — | `requirePermission` check fails |
| `404` | `NotFoundError` | — | School / User / Student / Teacher / Parent not found by ID |
| `422` | `ValidationError` | `REQUIRED` | `role_name`, `permission_key`, `role_id`, `permission_ids`, `user_id`, or `status` is missing |
| `400` | `AppError` | `UNSUPPORTED_ROLE` | Target user has a role that `editProfileService` doesn't handle |

---

## 5. Complete Request Data Flow

Full chain for `POST /api/admin/roles/assign-permissions`:

```
① HTTP POST /api/admin/roles/assign-permissions
   → activityMiddleware   (reads user_id from req.user → updates streak async)
   → authMiddleware       (verifies Bearer JWT → sets req.user)
   → requirePermission("MANAGE_SCHOOL")  (checks req.user.permissions[])
   → assignPermissionsToRole controller

② assignPermissionsToRole()
   → destructures { role_id, permission_ids } from req.body
   → AdminService.assignPermissionsToRoleService(role_id, permission_ids)

③ assignPermissionsToRoleService()
   → validates role_id and permission_ids presence
   → AdminRepo.removePermissionsFromRole(role_id)

④ AdminRolePermission.destroy({ where: { role_id } })
   → DELETE FROM admin_role_permissions WHERE role_id = ?

⑤ AdminRepo.bulkAssignPermissions(role_id, permission_ids)
   → AdminRolePermission.bulkCreate([{ role_id, permission_id }, ...])
   → INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ...

⑥ res.json(new ApiResponse(200, {}, "Permissions assigned to role successfully"))
```

---

*Schools2AI · Admin Module Documentation*
