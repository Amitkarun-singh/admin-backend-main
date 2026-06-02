# Feature Access Module — Technical Documentation
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

All feature access endpoints are mounted under `/api/features` (or similar prefix).

| Method | Endpoint | Auth Required | Permission | Purpose |
|--------|----------|---------------|------------|---------|
| `GET` | `/my-school` | Bearer JWT | None (commented out) | Get features enabled for my school |
| `GET` | `/overrides` | Bearer JWT | `MANAGE_SCHOOL` | List feature overrides for my school |
| `POST` | `/overrides` | Bearer JWT | `MANAGE_SCHOOL` | Create or update a single feature override |
| `DELETE` | `/overrides/:id` | Bearer JWT | `MANAGE_SCHOOL` | Remove a specific feature override |
| `POST` | `/overrides/bulk-class` | Bearer JWT | `MANAGE_SCHOOL` | Bulk-set feature overrides for an entire class |
| `POST` | `/overrides/bulk-section` | Bearer JWT | `MANAGE_SCHOOL` | Bulk-set feature overrides for an entire section |
| `GET` | `/my-access` | Bearer JWT | None | Get the feature access list for the current user |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level)

Registered via `router.use(activityMiddleware)`. Fires background streak update after authentication.

**Reads:** `req.user?.user_id`  
**Attaches:** Nothing

### 2.2 `authMiddleware` — all routes (per-route)

Validates Bearer JWT → sets `req.user = { user_id, role, permissions[], school_id }`.

### 2.3 `requirePermission("MANAGE_SCHOOL")` — admin-only routes

Checks `req.user.permissions.includes("MANAGE_SCHOOL")`.
Throws `ApiError(403, "Access denied")` if the permission is absent.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `GET /my-school`

Get all features that are enabled for the current user's school from `school_features`.

> **Note:** `requirePermission("MANAGE_SCHOOL")` is commented out — any authenticated user can call this.

#### Execution Flow

**Step 1 — Controller**
```ts
const { school_id } = req.user;
const features = await getMySchoolFeaturesService(school_id);
```

**Step 2 — Service: Query school features**
```ts
return SchoolFeature.findAll({
  where: { school_id, is_enabled: true },
  include: [{ model: Feature, attributes: ["feature_id", "feature_name", "feature_key", "description"] }]
});
// → SELECT school_features.*, features.*
//   FROM school_features
//   JOIN features ON school_features.feature_id = features.feature_id
//   WHERE school_id = ? AND is_enabled = true
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "feature_id": 13, "feature_name": "AI Assessment", "feature_key": "AI_ASSESSMENT", "is_enabled": true },
    { "feature_id": 18, "feature_name": "Doc Summarizer", "feature_key": "DOC_SUMMARISER", "is_enabled": true }
  ],
  "message": "School features fetched"
}
```

---

### 3.2 `GET /overrides`

List all feature overrides that the school has set (optionally filtered by feature or target type).

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `feature_id` | number | No | Filter overrides for a specific feature |
| `target_type` | string | No | Filter by `user`, `section`, `class`, or `role` |

#### Execution Flow

**Step 1 — Controller**
```ts
const { school_id } = req.user;
const { feature_id, target_type } = req.query;
const overrides = await getOverridesService(school_id, { feature_id, target_type });
```

**Step 2 — Service**
```ts
const where: any = { school_id };
if (feature_id) where.feature_id = feature_id;
if (target_type) where.target_type = target_type;

return FeatureOverride.findAll({ where });
// → SELECT * FROM feature_overrides WHERE school_id = ? [AND feature_id = ?] [AND target_type = ?]
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "id": 1, "feature_id": 13, "target_type": "class", "target_id": 3, "is_enabled": false }
  ],
  "message": "Overrides fetched"
}
```

---

### 3.3 `POST /overrides`

Create or update a single feature override. Supports target types: `user`, `section`, `class`, `role`.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feature_id` | number | Yes | Feature to override |
| `target_type` | string | Yes | `user`, `section`, `class`, or `role` |
| `target_id` | number | For `user`/`section`/`class` | ID of the target entity |
| `target_role` | string | For `role` | Role name (e.g. `"STUDENT"`) |
| `is_enabled` | boolean | Yes | Whether to enable or disable the feature |

#### Execution Flow

**Step 1 — Controller**
```ts
const { school_id, user_id } = req.user;
const result = await setOverrideService(school_id, user_id, req.body);
```

**Step 2 — Service: Validate feature exists**
```ts
const feature = await Feature.findByPk(feature_id);
if (!feature) throw new ApiError(404, "Feature not found");
```

**Step 3 — Service: Upsert override**
```ts
const [record, created] = await FeatureOverride.findOrCreate({
  where: { school_id, feature_id, target_type, target_id: target_id ?? null, target_role: target_role ?? null },
  defaults: { is_enabled, created_by: user_id }
});
if (!created) await record.update({ is_enabled });
// → INSERT INTO feature_overrides (...) ON DUPLICATE KEY UPDATE is_enabled = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "id": 1, "feature_id": 13, "target_type": "class", "target_id": 3, "is_enabled": false },
  "message": "Feature \"AI Assessment\" disabled for class"
}
```

---

### 3.4 `DELETE /overrides/:id`

Remove a specific feature override record.

#### Params

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Override record ID |

#### Execution Flow

```ts
const { id } = req.params;
const { school_id } = req.user;
await deleteOverrideService(id, school_id);
// → Verify override belongs to school
const override = await FeatureOverride.findOne({ where: { id, school_id } });
if (!override) throw new ApiError(404, "Override not found");
await override.destroy();
// → DELETE FROM feature_overrides WHERE id = ?
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {},
  "message": "Override removed"
}
```

---

### 3.5 `POST /overrides/bulk-class`

Bulk-enable or disable a feature for every section in a class (or all students directly).

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feature_id` | number | Yes | Feature to configure |
| `class_id` | number | Yes | Target class |
| `is_enabled` | boolean | Yes | Enable or disable |

#### Execution Flow

**Step 1 — Service: Load all sections in class**
```ts
const sections = await AdminSection.findAll({ where: { class_id } });
```

**Step 2 — Service: Upsert class-level override**
```ts
await FeatureOverride.upsert({
  school_id, feature_id, target_type: "class", target_id: class_id, is_enabled, created_by: user_id
});
// → INSERT INTO feature_overrides (...) ON DUPLICATE KEY UPDATE is_enabled = ?
```

**Step 3 — Service: Upsert section-level overrides**
```ts
for (const section of sections) {
  await FeatureOverride.upsert({
    school_id, feature_id, target_type: "section", target_id: section.section_id, is_enabled, created_by: user_id
  });
}
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [{ "target_type": "class", "target_id": 3 }, { "target_type": "section", "target_id": 7 }],
  "message": "Class feature overrides updated"
}
```

---

### 3.6 `POST /overrides/bulk-section`

Bulk-enable or disable a feature for every student in a section.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `feature_id` | number | Yes | Feature to configure |
| `section_id` | number | Yes | Target section |
| `is_enabled` | boolean | Yes | Enable or disable |

#### Execution Flow

```ts
// Upsert section-level override
await FeatureOverride.upsert({
  school_id, feature_id, target_type: "section", target_id: section_id, is_enabled
});
// → INSERT INTO feature_overrides (...) ON DUPLICATE KEY UPDATE is_enabled = ?

// Optionally upsert user-level overrides for all students in the section
const students = await StudentClassSection.findAll({ where: { section_id } });
for (const s of students) {
  await FeatureOverride.upsert({
    school_id, feature_id, target_type: "user", target_id: s.user_id, is_enabled
  });
}
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [...],
  "message": "Section feature overrides updated"
}
```

---

### 3.7 `GET /my-access`

Get the resolved list of features the **current user** can access, applying the full override resolution hierarchy.

#### Execution Flow

**Step 1 — Controller**
```ts
const { user_id, school_id, role } = req.user;
const resolved = await getMyAccessService(user_id, school_id, role);
```

**Step 2 — Service: Load school features**
```ts
const schoolFeatures = await SchoolFeature.findAll({
  where: { school_id, is_enabled: true },
  include: [Feature]
});
```

**Step 3 — Service: For each feature, resolve override**

Uses the same priority SQL as `requireFeature`:
- `user` > `section` > `class` > `role`

```ts
for (const sf of schoolFeatures) {
  const [override] = await sequelize.query<OverrideRow>(
    `SELECT is_enabled, target_type FROM feature_overrides
     WHERE school_id = :sid AND feature_id = :fid AND (
       (target_type = 'user' AND target_id = :uid) OR
       (target_type = 'section' AND target_id = :sec) OR
       (target_type = 'class' AND target_id = :cls) OR
       (target_type = 'role' AND target_role = :role)
     ) ORDER BY FIELD(target_type, 'user','section','class','role') LIMIT 1`,
    { replacements: { ... } }
  );
  resolvedAccess.push({
    feature_id: sf.feature_id,
    feature_key: sf.feature.feature_key,
    is_enabled: override?.is_enabled ?? true
  });
}
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": [
    { "feature_id": 13, "feature_key": "AI_ASSESSMENT", "is_enabled": true },
    { "feature_id": 18, "feature_key": "DOC_SUMMARISER", "is_enabled": false }
  ],
  "message": "Feature access fetched"
}
```

---

## 4. Error Reference

| HTTP | Class | Condition | Cause |
|------|-------|-----------|-------|
| `400` | `ApiError` | — | `target_type` invalid value |
| `400` | `ApiError` | — | `is_enabled` missing |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT |
| `403` | `ApiError` | — | `MANAGE_SCHOOL` permission missing |
| `404` | `ApiError` | — | Feature not found by `feature_id` |
| `404` | `ApiError` | — | Override not found (deleteOverride) |
| `500` | `Error` | — | Unexpected DB error |

---

## 5. Complete Request Data Flow

Full chain for `POST /overrides` (set a single override):

```
① HTTP POST /api/features/overrides
   → activityMiddleware    (streak update async)
   → authMiddleware        (JWT → req.user)
   → requirePermission("MANAGE_SCHOOL")
   → setOverride controller

② setOverride()
   → const { school_id, user_id } = req.user
   → setOverrideService(school_id, user_id, req.body)

③ setOverrideService()
   → Feature.findByPk(feature_id)
   → if (!feature) throw ApiError(404, "Feature not found")

④ FeatureOverride.findOrCreate({
     where: { school_id, feature_id, target_type, target_id, target_role },
     defaults: { is_enabled, created_by: user_id }
   })
   → Tries SELECT first:
   → SELECT * FROM feature_overrides WHERE school_id = ? AND feature_id = ? AND target_type = ? ...
   → If not found: INSERT INTO feature_overrides (...) VALUES (...)
   → If found: UPDATE feature_overrides SET is_enabled = ? WHERE id = ?

⑤ res.status(200).json(new ApiResponse(200, result.record,
     `Feature "${featureName}" ${is_enabled ? "enabled" : "disabled"} for ${target_type}`
   ))
```

---

*Schools2AI · Feature Access Module Documentation*
