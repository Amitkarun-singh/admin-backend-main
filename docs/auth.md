# Authentication Module — Technical Documentation
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

All auth endpoints are mounted under `/api/auth` (or similar prefix).

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `POST` | `/login` | None | Username + password login |
| `POST` | `/refresh-token` | Cookie (`refreshToken`) | Issue a new access token |
| `POST` | `/reset-first-time-password` | Bearer temp token | First-time password reset on new accounts |
| `POST` | `/verify-id-token` | None | Step 1 of forgot-password flow — verify Firebase ID token |
| `POST` | `/forgot-password/reset` | None | Step 2 of forgot-password — reset password using verified token |
| `GET` | `/profile` | Bearer JWT | Get the current user's full profile |
| `POST` | `/update-avatar` | Bearer JWT | Upload and update user avatar |
| `POST` | `/logout` | Bearer JWT | Invalidate session |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global (router-level)

Registered via `router.use(activityMiddleware)`. For public endpoints `req.user` is undefined so it calls `next()` immediately. For protected endpoints it fires a background streak update.

**Reads:** `req.user?.user_id`  
**Attaches:** Nothing

### 2.2 `authMiddleware` — protected routes (`/profile`, `/update-avatar`, `/logout`)

**File:** `src/middlewares/auth.middleware.ts`

**Step 1 — Read header**
```ts
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith("Bearer "))
  throw new ApiError(401, "Access token missing");
```

**Step 2 — Verify JWT**
```ts
const token = authHeader.split(" ")[1];
const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as UserTokenPayload;
req.user = decoded; // { user_id, role, permissions, school_id }
next();
```

### 2.3 `upload.single("file")` — avatar upload route

**File:** `src/middlewares/multer.middleware.ts`

Stores uploaded file to `./public/temp/` with a timestamp-based filename.
Sets `req.file = { fieldname, originalname, path, mimetype, size }`.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `POST /login`

Username and password login. Returns access + refresh tokens plus the full user profile.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Registered username |
| `password` | string | Yes | Account password |

#### Execution Flow

**Step 1 — Controller**
```ts
const result = await authService.login(req.body);
```

**Step 2 — Service: Find user**
```ts
const user = await userRepository.findByUsername(username);
// → User.findOne({ where: { username } })
if (!user) throw new ApiError(401, "Invalid credentials");
```

**Step 3 — Service: Password check**
```ts
const valid = await bcrypt.compare(password, user.password);
if (!valid) throw new ApiError(401, "Invalid credentials");
```

**Step 4 — Service: First-time password reset check**
```ts
if (user.is_password_reset_required) {
  const tempToken = generateTempToken({ user_id, purpose: "password_reset" });
  return { requiresPasswordReset: true, tempToken };
}
```

**Step 5 — Service: Load role + permissions**
```ts
const roleData = await roleRepository.findById(user.role_id);
const permissionKeys = roleData.permissions.map((p) => p.permission_key);
```

**Step 6 — Service: Issue tokens**
```ts
const payload = { user_id, role: roleData.role_name, permissions: permissionKeys, school_id };
const accessToken  = generateAccessToken(payload);   // jwt.sign, 1d
const refreshToken = generateRefreshToken(payload);  // jwt.sign, 7d
```

**Step 7 — Service: Load full profile (role-specific)**
```ts
// For STUDENT → StudentProfile.findOne({ where: { user_id }, include: [...] })
// For TEACHER → TeacherProfile.findOne({ where: { user_id }, include: [...] })
// For ADMIN / SUBADMIN → User.findByPk(user_id)
```

**Step 8 — Controller: Record login session**
```ts
await recordSession({ user_id: result.profile.user_id, ua: req.headers["user-agent"], ip: req.ip });
// → historyService.recordSession({ user_id, ua, ip })
```

**Step 9 — Controller: Set refresh cookie**
```ts
res.cookie("refreshToken", result.refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

#### Response — 200 OK (normal login)
```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "<JWT>",
    "refreshToken": "<JWT>",
    "role": "TEACHER",
    "permissions": ["MANAGE_SCHOOL"],
    "school_id": 1,
    "profile": { ... }
  },
  "message": "Login successful"
}
```

#### Response — 200 OK (first-time password reset required)
```json
{
  "statusCode": 200,
  "data": { "requiresPasswordReset": true, "tempToken": "<JWT>" },
  "message": "Password reset required"
}
```

---

### 3.2 `POST /refresh-token`

Issue a new access + refresh token pair from the `refreshToken` cookie.

#### Request

No body required. Reads `refreshToken` from the HTTP cookie.

#### Execution Flow

**Step 1 — Controller: Read cookie**
```ts
const incomingRefreshToken = req.cookies.refreshToken;
if (!incomingRefreshToken) throw new ValidationError([{ field: "refreshToken", code: "TOKEN_REQUIRED" }]);
```

**Step 2 — Controller: Verify refresh token**
```ts
const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
```

**Step 3 — Controller: Confirm user still exists**
```ts
const user = await userRepository.findById(decoded.user_id);
// → User.findByPk(user_id)
if (!user) throw new ValidationError([{ field: "refreshToken", code: "INVALID_TOKEN" }]);
```

**Step 4 — Controller: Issue fresh token pair**
```ts
const payload = { user_id, role: decoded.role, permissions: decoded.permissions, school_id: decoded.school_id };
const newAccessToken  = generateAccessToken(payload);
const newRefreshToken = generateRefreshToken(payload);
res.cookie("refreshToken", newRefreshToken, { httpOnly: true, secure: ..., sameSite: "strict", maxAge: 7d });
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "accessToken": "<new JWT>" },
  "message": "Token refreshed"
}
```

---

### 3.3 `POST /reset-first-time-password`

For accounts provisioned by an admin where `is_password_reset_required = true`. Uses a short-lived temp token instead of the standard Bearer token.

#### Request

**Headers:**
```
Authorization: Bearer <tempToken>  (issued by /login when requiresPasswordReset: true)
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newPassword` | string | Yes | New password |
| `confirmPassword` | string | Yes | Must match `newPassword` |

#### Execution Flow

**Step 1 — Controller: Extract + validate temp token**
```ts
const tempToken = req.headers.authorization?.split(" ")[1];
if (!tempToken) throw new ValidationError([{ field: "authorization", code: "TOKEN_REQUIRED" }]);
if (newPassword !== confirmPassword) throw new ValidationError([{ field: "confirmPassword", code: "PASSWORD_MISMATCH" }]);
const decoded = jwt.verify(tempToken, process.env.ACCESS_TOKEN_SECRET);
if (decoded.purpose !== "password_reset") throw ValidationError "INVALID_PURPOSE";
```

**Step 2 — Service: Hash + save**
```ts
const hashed = await bcrypt.hash(newPassword, 10);
await userRepository.update(user_id, { password: hashed, is_password_reset_required: false });
// → UPDATE users SET password = ?, is_password_reset_required = false WHERE user_id = ?
```

**Step 3 — Service + Controller: Auto-login**
```ts
const result = await authService.loginWithUserId(user_id);
res.cookie("refreshToken", result.refreshToken, { ... });
await recordSession({ user_id: result.profile.user_id, ua: ..., ip: ... });
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "accessToken": "...", "refreshToken": "...", "profile": { ... } },
  "message": "Password reset successful"
}
```

---

### 3.4 `POST /verify-id-token`

Step 1 of the **forgot-password** flow. Verifies a Firebase ID token (from OTP phone auth) and returns a signed `idToken` for use in the next step.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idToken` | string | Yes | Firebase phone-auth ID token |

#### Execution Flow

**Step 1 — Controller → Service**
```ts
const result = await authService.verifyIdToken(idToken);
// → getAuth(firebaseApp).verifyIdToken(idToken)
// Extracts phone number from Firebase decoded token
// Re-signs as internal JWT → { idToken: "<signed>" }
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "idToken": "<signed internal JWT>" },
  "message": "user verified"
}
```

---

### 3.5 `POST /forgot-password/reset`

Step 2 of forgot-password. Verifies the `idToken` from Step 1 and sets a new password.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phoneNumber` | string | Yes | Full phone number (last 10 digits used) |
| `newPassword` | string | Yes | New password |
| `confirmPassword` | string | Yes | Must match `newPassword` |
| `idToken` | string | Yes | Signed token from `/verify-id-token` |

#### Execution Flow

**Step 1 — Validate passwords match**
```ts
if (newPassword !== confirmPassword) throw new ValidationError([{ field: "confirmPassword", code: "PASSWORD_MISMATCH" }]);
```

**Step 2 — Normalize phone**
```ts
const phone_number = phoneNumber.trim().slice(-10);
```

**Step 3 — Service: Verify token + reset**
```ts
const result = await authService.resetPassword(phone_number, newPassword, confirmPassword, idToken);
// → Verifies idToken, finds user by phone, hashes new password, updates DB
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {},
  "message": "OTP verified"
}
```

---

### 3.6 `GET /profile`

Returns the current user's profile based on their role.

**Protected** — requires Bearer JWT.

#### Execution Flow

**Step 1 — Controller reads `user_id` and `role` from JWT**
```ts
const { user_id, role } = req.user;
```

**Step 2 — Load role-specific profile**

| Role | Query |
|------|-------|
| `STUDENT` | `StudentProfile.findOne({ where: { user_id }, include: [User, StudentClassSection → Class/Section, ParentProfile] })` |
| `TEACHER` | `TeacherProfile.findOne({ where: { user_id }, include: [User, primarySubject, assignments] })` |
| `ADMIN` / `SUBADMIN` | `User.findByPk(user_id, { include: [AdminRole] })` |
| `PARENT` | `ParentProfile.findOne({ where: { user_id }, include: [User, StudentProfile] })` |

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { /* role-specific profile object */ },
  "message": "Profile fetched"
}
```

---

### 3.7 `POST /update-avatar`

Upload and update user avatar image.

**Protected** — requires Bearer JWT.

**Request:** `Content-Type: multipart/form-data` — field name: `file`

#### Execution Flow

**Step 1 — Multer stores file to `./public/temp/`**

**Step 2 — Controller**
```ts
const { user_id } = req.user;
const filePath = req.file?.path;
if (!filePath) throw new ApiError(400, "File required");
```

**Step 3 — Upload to cloud storage + update DB**
```ts
const avatarUrl = await uploadToCloud(filePath); // e.g., Firebase Storage or S3
await userRepository.update(user_id, { avatar: avatarUrl });
// → UPDATE users SET avatar = ? WHERE user_id = ?
fs.unlinkSync(filePath); // Clean up temp file
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": { "avatar": "https://cdn.example.com/avatars/..." },
  "message": "Avatar updated"
}
```

---

### 3.8 `POST /logout`

Closes the user's active session and clears the refresh token cookie.

**Protected** — requires Bearer JWT.

#### Execution Flow

**Step 1 — Close session record**
```ts
await closeSession(req.user.user_id);
// → historyService.closeSession(user_id)
// → UPDATE login_sessions SET logout_at = NOW() WHERE user_id = ? AND logout_at IS NULL
```

**Step 2 — Clear cookie**
```ts
res.clearCookie("refreshToken", { httpOnly: true, secure: ..., sameSite: "strict" });
```

#### Response — 200 OK
```json
{
  "statusCode": 200,
  "data": {},
  "message": "Logout successful"
}
```

---

## 4. Error Reference

| HTTP | Class | Code | Cause |
|------|-------|------|-------|
| `400` | `ValidationError` | `TOKEN_REQUIRED` | `tempToken` or `refreshToken` is missing |
| `400` | `ValidationError` | `PASSWORD_MISMATCH` | `newPassword !== confirmPassword` |
| `400` | `ValidationError` | `INVALID_PURPOSE` | Temp token was not issued for `password_reset` |
| `400` | `ApiError` | — | Avatar file not provided |
| `401` | `ApiError` | — | Invalid username or password |
| `401` | `ApiError` | — | Missing/invalid Bearer JWT (protected routes) |
| `422` | `ValidationError` | `INVALID_TOKEN` | Temp token or refresh token is malformed/expired |

---

## 5. Complete Request Data Flow

Full chain for `POST /login`:

```
① HTTP POST /login
   → activityMiddleware  (no req.user yet → skips immediately)
   → login controller

② login()
   → authService.login({ username, password })

③ authService.login()
   → userRepository.findByUsername(username)
     → User.findOne({ where: { username } })
   → bcrypt.compare(password, user.password)
   → if (is_password_reset_required) → return { requiresPasswordReset: true, tempToken }
   → roleRepository.findById(user.role_id)
     → AdminRole.findOne({ where: { role_id }, include: [permissions] })
   → generateAccessToken(payload)    [jwt.sign, 1d expiry]
   → generateRefreshToken(payload)   [jwt.sign, 7d expiry]
   → Load role-specific profile from DB

④ Back in controller:
   → recordSession({ user_id, ua, ip })
     → INSERT INTO login_sessions (user_id, ua, ip, login_at) VALUES (...)
   → res.cookie("refreshToken", ..., { httpOnly, secure, sameSite: "strict" })

⑤ res.status(200).json(new ApiResponse(200, result, "Login successful"))
   → { accessToken, refreshToken, role, permissions, school_id, profile }
```

---

*Schools2AI · Authentication Module Documentation*
