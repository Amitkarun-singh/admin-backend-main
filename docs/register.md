# Registration Module — Technical Documentation
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

All registration endpoints are mounted under `/api/auth/register`.

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| `POST` | `/api/auth/register/` | None | Self-register a new user (STUDENT or TEACHER) |
| `POST` | `/api/auth/register/resend-otp` | None | Resend OTP token for phone verification |
| `POST` | `/api/auth/register/verify-otp` | None | Verify OTP and activate account |
| `GET` | `/api/auth/register/onboarding` | Bearer JWT | Fetch classes, subjects, and school info for profile completion |
| `POST` | `/api/auth/register/complete-profile` | Bearer JWT | Complete role-specific profile (STUDENT or TEACHER) |

---

## 2. Middleware Pipeline

### 2.1 `activityMiddleware` — global, all routes

**File:** `src/middlewares/activity.middleware.ts`

Registered via `router.use(activityMiddleware)`. For public routes (`/`, `/resend-otp`, `/verify-otp`) `req.user` is `undefined` so the middleware calls `next()` immediately.

For authenticated routes (`/onboarding`, `/complete-profile`) it fires a background streak update after `authMiddleware` has set `req.user`.

**Step 1 — Check user**
```ts
const user_id = req.user?.user_id;
if (!user_id) return next(); // Skip for public routes
```

**Step 2 — In-memory cache guard**
```ts
const cacheKey = `${user_id}:${todayIST()}`;
if (_seenToday.has(cacheKey)) return next();
```

**Step 3 — Fire-and-forget DB write**
```ts
_updateStreakBackground(user_id, today, cacheKey).catch(() => {});
return next();
```

---

### 2.2 `authMiddleware` — protected routes (`/onboarding`, `/complete-profile`)

**File:** `src/middlewares/auth.middleware.ts`

Verifies Bearer JWT and attaches `{ user_id, role, school_id, permissions }` to `req.user`.

---

## 3. Route-by-Route Deep Dive

---

### 3.1 `POST /api/auth/register/`

Self-registration for STUDENT or TEACHER. Verified via Firebase ID token, creates user + profile in one shot and returns a full login response.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | `STUDENT` or `TEACHER` |
| `full_name` | string | Yes | User's full name |
| `password` | string | Yes | Account password |
| `phone_number` | string | Yes | Phone number (last 10 digits used) |
| `email` | string | No | Optional email |
| `board` | string | Yes | Must be `CBSE` for self-registration |
| `idToken` | string | Yes | Firebase phone-auth ID token |
| `class` | string | No | Comma-separated class names (e.g. `"Grade 10"`) |
| `self_register` | boolean | No | Marks account as self-registered |

#### Execution Flow

**Step 1 — Controller**
```ts
const result = await registerService.register(req.body);
```

**Step 2 — Service: Firebase verification**
```ts
await authService.verifyIdToken(idToken);
// → getAuth(firebaseApp).verifyIdToken(idToken)
// Failure → ValidationError({ code: "INVALID_TOKEN" })
```

**Step 3 — Service: Board validation**
```ts
if (board.toUpperCase() !== "CBSE")
  validation.push({ field: "board", code: "BOARD_NOT_SUPPORTED" });
```

**Step 4 — Service: Uniqueness checks**
```ts
const contact_number = phone_number.trim().slice(-10);
const takenPhone = await userRepository.findByPhoneNumber(contact_number);
// → User.findOne({ where: { phone_number } })
if (takenPhone) validation.push({ field: "phone_number", code: "DUPLICATE_PHONE" });

const takenEmail = await userRepository.findByEmail(email.trim());
// → User.findOne({ where: { email } })
if (takenEmail) validation.push({ field: "email", code: "DUPLICATE_EMAIL" });
```

**Step 5 — Service: Role & School lookup**
```ts
const roleRecord = await roleRepository.findByName(role);
// → AdminRole.findOne({ where: { role_name } })

const cbseSchool = await schoolRepository.findActiveCbseSchool();
// → AdminSchool.findOne({ where: { board: "CBSE", status: "active" } })
```

**Step 6 — Service: Class resolution**
```ts
// Normalizes class names: "10" → ["Grade 10", "Grade10"]
const classRecords = await classRepository.findByNames(searchPatterns);
// → AdminClass.findAll({ where: { class_name: { [Op.in]: patterns } } })
```

**Step 7 — Service: Create User**
```ts
const hashed = await bcrypt.hash(password, 10);
const user = await userRepository.create({
  full_name, password: hashed, phone_number: contact_number,
  email, role_id, school_id, status: "Active", is_password_reset_required: false,
});
// → INSERT INTO users (...) VALUES (...)
```

**Step 8 — Service: Create Profile (role-specific)**

*For TEACHER:*
```ts
const teacherProfile = await profileRepository.createTeacherProfile({
  user_id, school_id, onboarding_date: new Date()
});
// → INSERT INTO teacher_profiles (...) VALUES (...)
for (const cls of classRecords) {
  await profileRepository.createTeacherClassSectionSubject({ teacher_id, class_id, academic_year });
}
await schoolRepository.incrementCount(school_id, "teacher_count");
// → UPDATE admin_schools SET teacher_count = teacher_count + 1 WHERE school_id = ?
```

*For STUDENT:*
```ts
const studentProfile = await profileRepository.createStudentProfile({ user_id, school_id });
await profileRepository.createStudentClassSection({ student_id, class_id });
await schoolRepository.incrementCount(school_id, "student_count");
```

**Step 9 — Service: Auto-login**
```ts
return await authService.loginWithUserId(user.user_id);
// → Issues accessToken + refreshToken, loads full profile
```

**Step 10 — Controller: Set refresh cookie**
```ts
res.cookie("refreshToken", result.refreshToken, {
  httpOnly: true, secure: true, sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

#### Response — 201 Created

```json
{
  "statusCode": 201,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "role": "STUDENT",
    "permissions": [],
    "school_id": 1,
    "profile": { ... }
  },
  "message": "Account created and verified"
}
```

---

### 3.2 `POST /api/auth/register/resend-otp`

Resend a new OTP token to a phone number that hasn't been verified yet.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone_number` | string | Yes | Phone number of the unverified account |

#### Execution Flow

**Step 1 — Controller**
```ts
const result = await registerService.resendOtp(phone_number);
```

**Step 2 — Service: Normalize phone**
```ts
const contact_number = phone_number.trim().slice(-10);
```

**Step 3 — Service: Find user**
```ts
const user = await userRepository.findByPhoneNumber(contact_number);
// → User.findOne({ where: { phone_number } })
if (!user) throw new ApiError(404, "No account found");
```

**Step 4 — Service: Guard active accounts**
```ts
if (user.status === "Active")
  throw new ApiError(400, "Account already verified");
```

**Step 5 — Service: Generate OTP token**
```ts
const otp = generateOTP(); // Random 6-digit number
const otpToken = createOtpToken(contact_number, otp); // HMAC-signed JWT
return { otpToken, otp };
```

> **Dev note:** `otp` is logged to the console — remove before production.

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": { "otpToken": "<signed JWT containing hashed OTP>" },
  "message": "OTP resent"
}
```

---

### 3.3 `POST /api/auth/register/verify-otp`

Verify an OTP and activate the user account. Returns full login tokens.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone_number` | string | Yes | Phone number of the account |
| `otp` | string | Yes | OTP received by user |
| `otpToken` | string | Yes | Signed token from `resend-otp` or initial registration |

#### Execution Flow

**Step 1 — Controller**
```ts
const result = await registerService.verifyRegistrationOtp(phone_number, otp, otpToken);
```

**Step 2 — Service: Verify OTP token**
```ts
verifyOtpToken(contact_number, otp, otpToken);
// → Decodes JWT, compares hashed OTP
// Failure → ApiError (400/401)
```

**Step 3 — Service: Find user**
```ts
const user = await userRepository.findByPhoneNumber(contact_number);
if (!user) throw new ApiError(404, "User not found");
```

**Step 4 — Service: Activate account**
```ts
await userRepository.update(user.user_id, { status: "Active" });
// → UPDATE users SET status = 'Active' WHERE user_id = ?
```

**Step 5 — Service: Auto-login**
```ts
return await authService.loginWithUserId(user.user_id);
```

**Step 6 — Controller: Set refresh cookie**
```ts
res.cookie("refreshToken", result.refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "role": "STUDENT",
    "profile": { ... }
  },
  "message": "Phone verified"
}
```

---

### 3.4 `GET /api/auth/register/onboarding`

Returns all the data needed for the profile-completion step: classes, subjects (teachers only), languages, and school info.

> **Protected** — requires Bearer JWT. `req.user` provides `role` and `school_id`.

#### Execution Flow

**Step 1 — Controller: parallel queries**
```ts
const [classes, school] = await Promise.all([
  AdminClass.findAll({ order: [["class_id", "ASC"]], attributes: ["class_id", "class_name"] }),
  // → SELECT class_id, class_name FROM admin_classes ORDER BY class_id ASC

  schoolRepository.findById(school_id, ["school_name", "board", "language_preference"]),
  // → AdminSchool.findOne({ where: { school_id }, attributes: [...] })
]);
```

**Step 2 — Conditional subjects (TEACHER only)**
```ts
if (role === "TEACHER") {
  subjects = await AdminSubject.findAll({
    where: { board: school?.board || "CBSE" },
    attributes: ["subject_id", "subject_name", "class_id", "board", "language"],
    order: [["subject_name", "ASC"]],
  });
  // → SELECT ... FROM admin_subject_masters WHERE board = ? ORDER BY subject_name ASC
}
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {
    "classes": [{ "class_id": 1, "class_name": "Grade 10" }],
    "subjects": [{ "subject_id": 3, "subject_name": "Mathematics", "class_id": 1 }],
    "languages": ["English", "Hindi", "Marathi", ...],
    "school_name": "CBSE School",
    "board": "CBSE",
    "language_default": "English"
  },
  "message": "Onboarding data fetched"
}
```

---

### 3.5 `POST /api/auth/register/complete-profile`

Complete the profile for an already-registered STUDENT or TEACHER.

> **Protected** — requires Bearer JWT.

#### Request Body

**For STUDENT:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `class_id` | number | Yes | Class to enroll in |
| `preferred_language` | string | No | Preferred language |
| `dob` | string | No | Date of birth |
| `gender` | string | No | Gender |
| `analytics_enabled` | boolean | No | Whether analytics is enabled |

**For TEACHER:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `primary_subject_id` | number | No | Primary subject ID |
| `preferred_language` | string | No | Preferred language |
| `experience` | number | No | Years of experience |
| `age` | number | No | Age |
| `device_type` | string | No | Device type |

#### Execution Flow

**Step 1 — Controller: branch by role**
```ts
const { user_id, role, school_id } = req.user;
if (role === "STUDENT") {
  profile = await registerService.completeStudentProfile(user_id, school_id, req.body);
} else if (role === "TEACHER") {
  profile = await registerService.completeTeacherProfile(user_id, school_id, req.body);
}
```

**Step 2 (STUDENT) — Service: Upsert student profile**
```ts
let profile = await profileRepository.findStudentByUserId(user_id);
if (profile) {
  await profile.update({ preferred_language, dob, gender, analytics_enabled });
} else {
  profile = await profileRepository.createStudentProfile({ user_id, school_id, ... });
}
// → INSERT or UPDATE student_profiles
```

**Step 3 (STUDENT) — Service: Upsert class section**
```ts
const existingSection = await profileRepository.findStudentClassSection(profile.student_id);
if (!existingSection) {
  await profileRepository.createStudentClassSection({ student_id, class_id, status: "active" });
} else {
  await existingSection.update({ class_id });
}
// → INSERT or UPDATE student_class_sections
await schoolRepository.incrementCount(school_id, "student_count");
```

**Step 2 (TEACHER) — Service: Upsert teacher profile**
```ts
let profile = await profileRepository.findTeacherByUserId(user_id);
if (profile) {
  await profile.update({ primary_subject_id, preferred_language, experience, age, device_type });
} else {
  profile = await profileRepository.createTeacherProfile({ user_id, school_id, ... });
}
await schoolRepository.incrementCount(school_id, "teacher_count");
```

#### Response — 200 OK

```json
{
  "statusCode": 200,
  "data": {
    "profile": { /* StudentProfile or TeacherProfile */ },
    "profileComplete": true
  },
  "message": "Profile completed"
}
```

---

## 4. Error Reference

| HTTP | Class/Type | Code | Cause |
|------|-----------|------|-------|
| `400` | `ApiError` | — | Board is not CBSE |
| `400` | `ApiError` | — | Account already verified (resend-otp) |
| `400` | `ApiError` | — | OTP token verification failed |
| `401` | `ApiError` | — | Missing/invalid Bearer token |
| `404` | `ApiError` | — | No account found by phone number |
| `404` | `ApiError` | — | User not found during OTP verification |
| `422` | `ValidationError` | `DUPLICATE_PHONE` | Phone number already registered |
| `422` | `ValidationError` | `DUPLICATE_EMAIL` | Email already registered |
| `422` | `ValidationError` | `ROLE_NOT_FOUND` | Provided role doesn't exist in DB |
| `422` | `ValidationError` | `SCHOOL_NOT_FOUND` | No active CBSE school found |
| `422` | `ValidationError` | `CLASS_NOT_FOUND` | One or more class names don't match DB records |
| `422` | `ValidationError` | `INVALID_TOKEN` | Firebase ID token invalid or expired |
| `422` | `ValidationError` | `BOARD_NOT_SUPPORTED` | Board is not CBSE |

---

## 5. Complete Request Data Flow

Full chain for `POST /api/auth/register/` (self-registration):

```
① HTTP POST /api/auth/register/
   → activityMiddleware   (no req.user → skips immediately)
   → register controller

② register()
   → registerService.register(req.body)

③ registerService.register()
   → authService.verifyIdToken(idToken)       [Firebase Admin SDK]
   → userRepository.findByPhoneNumber()        [User.findOne]
   → userRepository.findByEmail()              [User.findOne]
   → roleRepository.findByName(role)           [AdminRole.findOne]
   → schoolRepository.findActiveCbseSchool()   [AdminSchool.findOne]
   → classRepository.findByNames(patterns)     [AdminClass.findAll]

④ User creation
   → bcrypt.hash(password, 10)
   → userRepository.create({ ... })
   → INSERT INTO users (...) VALUES (...)

⑤ Profile creation (STUDENT branch)
   → profileRepository.createStudentProfile({ user_id, school_id })
   → INSERT INTO student_profiles (...) VALUES (...)
   → profileRepository.createStudentClassSection({ student_id, class_id })
   → INSERT INTO student_class_sections (...) VALUES (...)
   → schoolRepository.incrementCount(school_id, "student_count")
   → UPDATE admin_schools SET student_count = student_count + 1

⑥ Auto-login
   → authService.loginWithUserId(user.user_id)
   → generateAccessToken(payload)   [jwt.sign]
   → generateRefreshToken(payload)  [jwt.sign]

⑦ res.cookie("refreshToken", ..., { httpOnly, secure, sameSite: "none" })

⑧ res.status(201).json(new ApiResponse(201, result, "Account created and verified"))
```

---

*Schools2AI · Registration Module Documentation*
