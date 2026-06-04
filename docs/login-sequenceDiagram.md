# Authentication API

## Login User

Authenticates a user via standard profile credentials.

* **URL:** `/api/auth/login`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`

### Request Body

```json
{
  "username": "student_demo",
  "password": "Student@1234"
}

{
  "phone_number": "+911234567890",
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6I..."
}
```



```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Frontend
    participant R as Router (auth.routes.ts)
    participant C as Controller (auth.controller.ts)
    participant S as AuthService (auth.service.ts)
    participant Repo as UserRepository
    participant FB as Firebase Admin
    participant JWT as JWT Library
    participant H as History Controller

    Client->>R: POST /login (payload)
    R->>C: login(req, res)
    C->>S: login(req.body)
    
    %% ---- Verification Step ----
    note over S: Step 1: Verify Credentials
    S->>S: verifyCredentials(loginData)
    
    alt Mode A: Username/Email + Password
        S->>Repo: findByUsername() / findByEmail()
        Repo-->>S: user
        S->>S: bcrypt.compare(password, user.password)
    else Mode B: Phone Number + Firebase idToken
        S->>S: verifyIdToken(idToken)
        S->>FB: verifyIdToken(idToken)
        FB-->>S: decodedToken
        S->>Repo: findByPhoneNumber(clean_number)
        Repo-->>S: user
    end

    %% ---- Status Check ----
    note over S: Step 2: Account Status Validation
    alt User is not Active
        S-->>C: throw ValidationError("User inactive")
        C-->>Client: 400/422 Bad Request (Error response)
    end

    %% ---- Conditional Paths ----
    note over S: Step 3: Evaluate Password Reset Requirement
    alt Scenario 1: First-Time Login Required (is_password_reset_required = true)
        S->>JWT: sign({ user_id, purpose: "password_reset" })
        JWT-->>S: tempToken
        S-->>C: return { requiresPasswordReset: true, tempToken }
        C-->>Client: 200 OK (ApiResponse: "Password reset required")
        
    else Scenario 2: Standard Successful Login
        S->>S: loginWithUserId(user_id)
        S->>Repo: findWithRoleAndPermissions(user_id)
        Repo-->>S: userWithRole
        
        opt User has Avatar Key
            S->>S: signAvatar(key, role_name)
            note over S: Generates S3 pre-signed URL
        end
        
        S->>JWT: generateAccessToken(payload)
        S->>JWT: generateRefreshToken(payload)
        S-->>C: return { accessToken, refreshToken, profile, ... }
        
        %% ---- Cookie & Session Setting ----
        note over C: Step 4: Finalize Session & Send Tokens
        C->>C: res.cookie("refreshToken", token, httpOnly: true)
        C->>H: recordSession({ user_id, ua, ip })
        C-->>Client: 200 OK (ApiResponse: "Login successful")
    end