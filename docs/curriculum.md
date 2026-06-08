Here’s a clean **technical API documentation** your team can directly use for the Curriculum module.

---

# 📘 Curriculum API Documentation

Base URL:

```
/api/v1/curriculum
```

All endpoints require authentication via:

```
authMiddleware
```

So user must send a valid token (based on your auth implementation, usually Bearer JWT).

---

# 🔐 Authentication

All APIs require:

```
Authorization: Bearer <token>
```

If token is missing/invalid → request is rejected.

---

# 📚 Overview

This module provides curriculum data in hierarchical order:

```
Class → Subject → Chapter
          ↘ Stream
```

It also supports **role-based responses**:

* 👨‍🎓 Student → only assigned data
* 👨‍🏫 Others (Admin/Teacher/etc.) → full data

---

# 📖 1. Get Classes

### Endpoint

```
GET /api/v1/curriculum/class
```

### Description

Fetch list of classes.

### Role Behavior

| Role    | Response              |
| ------- | --------------------- |
| student | Only assigned classes |
| others  | All classes           |

### Response

```json
[
  {
    "id": 1,
    "name": "Class 10"
  }
]
```

---

# 📘 2. Get Subjects of a Class

### Endpoint

```
GET /api/v1/curriculum/class/:classId/subject
```

### Path Params

| Param   | Type   | Required |
| ------- | ------ | -------- |
| classId | number | Yes      |

### Query Params (optional)

| Param    | Type   | Description      |
| -------- | ------ | ---------------- |
| board    | string | Filter by board  |
| streamId | number | Filter by stream |

### Example

```
/class/1/subject?board=CBSE&streamId=2
```

### Role Behavior

| Role    | Response               |
| ------- | ---------------------- |
| student | Assigned subjects only |
| others  | All subjects           |

---

# 🌐 3. Get Streams

### Endpoint

```
GET /api/v1/curriculum/stream
```

### Description

Fetch all available streams (e.g. Science, Commerce, Arts).

### Response

```json
[
  {
    "id": 1,
    "name": "Science"
  }
]
```

### Role Behavior

Same for all users (no restriction).

---

# 📗 4. Get Chapters of a Subject

### Endpoint

```
GET /api/v1/curriculum/class/:classId/subject/:subjectId/chapter
```

### Path Params

| Param     | Type   | Required |
| --------- | ------ | -------- |
| classId   | number | Yes      |
| subjectId | number | Yes      |

### Query Params (optional)

| Param    | Type   | Description      |
| -------- | ------ | ---------------- |
| board    | string | Filter by board  |
| streamId | number | Filter by stream |
| lang     | string | Language filter  |

### Example

```
/class/1/subject/5/chapter?board=CBSE&streamId=2&lang=en
```

### Role Behavior

| Role    | Response               |
| ------- | ---------------------- |
| student | Only assigned chapters |
| others  | All chapters           |

---

# 🧠 Business Logic Summary

### Students

Always filtered by:

* userId
* schoolId
* assigned mappings

Handled via:

* `onlyAsignClass`
* `onlyAsignSubject`
* `onlyAsignChapter`

---

### Admin/Teacher

No restriction:

* `allClass`
* `allSubject`
* `allChapter`

---

# ⚙️ Service Layer Mapping

| Controller | Service                                     |
| ---------- | ------------------------------------------- |
| classes    | CurriculumService.onlyAsignClass / allClass |
| subject    | onlyAsignSubject / allSubject               |
| stream     | stream                                      |
| chapter    | onlyAsignChapter / allChapter               |

---

# 🚨 Error Handling (Expected)

### 401 Unauthorized

```json
{
  "message": "Unauthorized"
}
```

### 400 Bad Request

```json
{
  "message": "Invalid parameters"
}
```

### 500 Server Error

```json
{
  "message": "Internal server error"
}
```

---

# 🧪 Sample API Flow

### Step 1: Get Classes

```
GET /class
```

### Step 2: Get Subjects

```
GET /class/1/subject
```

### Step 3: Get Streams (optional filter)

```
GET /stream
```

### Step 4: Get Chapters

```
GET /class/1/subject/5/chapter
```

---

# 🧾 Notes for Developers

* Always ensure `req.user` is populated by `authMiddleware`
* Role comparison is case-insensitive (`role.toLowerCase()`)
* Query params are optional but affect filtering
* Student data is strictly scoped by assignment mapping


