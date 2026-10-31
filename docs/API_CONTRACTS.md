# REST API Contracts & Specifications

**Project:** Generative AI Framework for Personalized Laboratory Learning Environments  
**Document Status:** Production Implemented & Verified (Phase 3C — Core CRUD & Multi-Tenant Persistence)  
**Base URL:** `/api/v1` (System Health & Readiness at `/api/health` and `/api/health/ready`)  
**Standard Data Exchange:** `application/json`  

---

## 1. Global Architectural Standards

### 1.1. Multi-Tenant Context & Request Headers
Every request directed to institution-scoped endpoints must present verified identity context through the HTTP header or cryptographically signed session/token:

| Header Name | Type | Description | Required By |
|---|---|---|---|
| `Authorization` | String | `Bearer <JWT_TOKEN>` carrying authenticated user identity, role, and institutional claim. | All authenticated endpoints |
| `X-Institution-Id` | Hex String | Mongo ObjectId of the target institution tenant (validated against token claims). | Multi-tenant scoped routes |
| `X-Request-Id` | UUID | Client or gateway correlation ID for distributed tracing and audit logs. | Optional (generated server-side if omitted) |

### 1.2. Standard Response Envelopes

#### Success Envelope (Single Entity)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_8f1a2e3b",
    "timestamp": "2026-10-20T17:00:00.000Z"
  }
}
```

#### Success Envelope (Paginated Collection)
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 85,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "meta": {
    "requestId": "req_8f1a2e3b",
    "timestamp": "2026-10-20T17:00:00.000Z"
  }
}
```

#### Error Envelope (Consistent RFC-7807 Inspired)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Input validation failed on one or more fields.",
    "details": [
      {
        "field": "code",
        "message": "Department code must be unique within the institution."
      }
    ],
    "requestId": "req_8f1a2e3b",
    "timestamp": "2026-10-20T17:00:00.000Z"
  }
}
```

Standard HTTP Error Codes:
- `400 Bad Request`: Validation failure, malformed payload, missing required query/body fields.
- `401 Unauthorized`: Missing, expired, or cryptographically invalid token.
- `403 Forbidden`: Authenticated user lacks the required RBAC role or violates cross-tenant isolation boundaries.
- `404 Not Found`: Target resource does not exist in the tenant's partition.
- `409 Conflict`: Resource unique index violation (e.g. duplicate department code or experiment code).
- `422 Unprocessable Entity`: Semantic logic violation (e.g. attempt to submit assessment without starting).
- `429 Too Many Requests`: Rate limit exceeded (per-IP or per-token quota).
- `500 Internal Server Error`: Server exception (details masked from client, logged to append-only audit log).
- `503 Service Unavailable`: Dependent service (MongoDB Atlas, Object Store) unavailable.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Domain / Resource Group | Platform Admin | College Admin | Faculty | Student |
|---|---|---|---|---|
| **System Health & Probes** | Read | Read | Read | Read |
| **Institutions** | Create, Read, Update, Delete | Read (Own) | Read (Own) | Read (Own basic) |
| **Academic Hierarchy** (Dept, Course, Subject, Lab) | Read All | Create, Read, Update, Delete (Own) | Read (Assigned) | Read (Enrolled) |
| **Experiments** | Read All | Read (Own), Archive | Create, Read, Update, Publish | Read (Enrolled, Published) |
| **User Directory** | Read All | Create, Read, Update, Suspend (Own) | Read (Students in course) | Read (Self profile) |
| **Learning Resources** | Read All | Read (Own), Manage Quota | Upload, Read, Update, Archive | Read (Grounded docs for lab) |
| **Assessments** | Read All | Read (Own metrics) | Create, Read, Update, Publish | Read (Enrolled), Attempt |
| **Assessment Attempts** | Read All | Read (Analytics) | Read (Class submissions) | Read (Own attempts), Submit |
| **Learning Sessions** | Read All | Read (Aggregates) | Read (Live student steps) | Create, Read (Self), Update steps |
| **Help Requests** | Read All | Read (Escalation queue) | Read, Respond, Resolve | Create, Read (Self) |
| **Audit Logs** | Read All | Read (Own tenant events) | Forbidden | Forbidden |

---

## 3. Endpoints Specification

### 3.1. System Health & Readiness Endpoints
Base path: `/api`

#### `GET /api/health`
- **Description:** Lightweight liveness probe for process orchestrators and load balancers.
- **Authorization:** Public
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-20T17:00:00.000Z",
    "service": "genai-lab-backend",
    "uptimeSeconds": 3600
  }
  ```

#### `GET /api/health/ready`
- **Description:** Readiness probe verifying active MongoDB Atlas connectivity without exposing credentials.
- **Authorization:** Public
- **Response `200 OK` (when connected):**
  ```json
  {
    "status": "ready",
    "timestamp": "2026-10-20T17:00:00.000Z",
    "service": "genai-lab-backend",
    "database": {
      "status": "connected",
      "readyState": "connected",
      "databaseName": "genai_lab_learning_db"
    }
  }
  ```
- **Response `503 Service Unavailable` (when database is disconnected):**
  ```json
  {
    "status": "not_ready",
    "timestamp": "2026-10-20T17:00:00.000Z",
    "service": "genai-lab-backend",
    "database": {
      "status": "disconnected",
      "readyState": "disconnected",
      "message": "Database connection is not established. Verify MONGODB_URI configuration."
    }
  }
  ```

---

### 3.2. Authentication & Session APIs (Phase 3B — Implemented)
Base path: `/api/v1/auth`

#### `POST /api/v1/auth/login`
- **Description:** Authenticates a user with email and password, returning short-lived access JWT and refresh token. Fails closed with 503 if database is disconnected. Protected by rate limiting (10 attempts/min).
- **Authorization:** Public
- **Request Body:**
  ```json
  {
    "email": "student@apex.edu",
    "password": "StrongPassword123!"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "tokens": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "eyJhbGciOi...",
        "tokenType": "Bearer",
        "expiresIn": "15m"
      },
      "user": {
        "id": "6715...",
        "name": "Aarav Sharma",
        "email": "student@apex.edu",
        "role": "student",
        "institutionId": "6715...",
        "departmentId": "6715...",
        "status": "active"
      }
    },
    "meta": {
      "timestamp": "2026-10-20T17:00:00.000Z"
    }
  }
  ```
- **Error `401 Unauthorized`:** Generic error returned for invalid email, wrong password, or lockout (`INVALID_CREDENTIALS` / `ACCOUNT_LOCKED`). Never reveals whether email or password was wrong.
- **Error `429 Too Many Requests`:** Returned when client exceeds rate limit. Includes `Retry-After` header.
- **Error `503 Service Unavailable`:** Returned if MongoDB database is disconnected.

#### `POST /api/v1/auth/refresh`
- **Description:** Rotates refresh token and issues a new access token. Employs single-use token tracking via SHA-256 hash. Revokes session upon token reuse detection.
- **Authorization:** Public (requires valid refresh token in body)
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response `200 OK`:** Returns new token pair.

#### `GET /api/v1/auth/me`
- **Description:** Retrieves the authenticated user's current identity, role, and institutional profile.
- **Authorization:** Authenticated (`Bearer <access_token>`)
- **Response `200 OK`:** Returns user identity and institutional claims.

#### `POST /api/v1/auth/logout`
- **Description:** Invalidates the current user's active refresh token in database security storage.
- **Authorization:** Authenticated (`Bearer <access_token>`)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully logged out. Active session refresh token revoked."
    }
  }
  ```

---

### 3.3. Institutions API
Base path: `/api/v1/institutions`

#### `POST /api/v1/institutions`
- **Description:** Provision a new tenant institution in the platform.
- **Authorization:** Platform Admin only
- **Request Body:**
  ```json
  {
    "name": "Apex Engineering Institute",
    "code": "APEX-ENG",
    "domain": "apex.edu",
    "type": "engineering_college",
    "adminEmail": "provost@apex.edu",
    "contactPhone": "+91-9876543210",
    "address": {
      "street": "100 Innovation Corridor",
      "city": "Bengaluru",
      "state": "Karnataka",
      "country": "India",
      "postalCode": "560100"
    },
    "enabledModules": ["core", "ai_learning", "assessment"],
    "settings": {
      "maxStudents": 2500,
      "maxFaculty": 180,
      "storageQuotaMb": 102400,
      "defaultAiModel": "claude-3-5-sonnet"
    }
  }
  ```
- **Response `201 Created`:** Returns created `Institution` object.
- **Error `409 Conflict`:** If `code` or `domain` already registered.

#### `GET /api/v1/institutions`
- **Description:** List institutions with pagination and filtering.
- **Authorization:** Platform Admin only
- **Query Parameters:** `page=1`, `limit=20`, `search=Apex`, `status=active`, `type=engineering_college`
- **Response `200 OK`:** Paginated array of `Institution` objects.

#### `GET /api/v1/institutions/:id`
- **Description:** Get detailed institutional metadata and subscription settings.
- **Authorization:** Platform Admin or College Admin (matching own tenant ID).
- **Response `200 OK`:** Single `Institution` object.

#### `PATCH /api/v1/institutions/:id`
- **Description:** Update institutional configuration, status, enabled modules, or quotas.
- **Authorization:** Platform Admin
- **Request Body:** Partial `Institution` schema fields (`status`, `enabledModules`, `settings`).

---

### 3.3. Academic Hierarchy APIs

#### 3.3.1. Departments (`/api/v1/departments`)
- `GET /api/v1/departments`
  - **Auth:** College Admin, Faculty, Student
  - **Query:** `page=1`, `limit=50`, `status=active` (Tenant scoped to user's `institutionId`)
  - **Response `200 OK`:** Paginated array of `Department` objects.
- `POST /api/v1/departments`
  - **Auth:** College Admin
  - **Request Body:** `{ "name": "Computer Science and Engineering", "code": "CSE", "headOfDepartment": "Dr. Sarah Rao", "description": "Undergraduate and postgraduate computing curricula." }`
  - **Response `201 Created`**
  - **Error `409 Conflict`:** Duplicate department code within the same institution.
- `GET /api/v1/departments/:id` (Auth: College Admin, Faculty, Student)
- `PATCH /api/v1/departments/:id` (Auth: College Admin)
- `DELETE /api/v1/departments/:id` (Auth: College Admin; blocked if child courses exist)

#### 3.3.2. Courses (`/api/v1/courses`)
- `GET /api/v1/courses`
  - **Auth:** College Admin, Faculty, Student
  - **Query:** `departmentId=<ID>`, `degreeLevel=undergraduate`, `page=1`, `limit=20`
  - **Response `200 OK`:** Paginated array of `Course` objects.
- `POST /api/v1/courses`
  - **Auth:** College Admin
  - **Request Body:** `{ "departmentId": "6715...", "name": "B.Tech Computer Science and Engineering", "code": "CS-UG-2024", "degreeLevel": "undergraduate", "totalSemesters": 8, "academicYear": "2024-2028" }`
  - **Response `201 Created`**
  - **Error `409 Conflict`:** Duplicate course code within the department.
- `GET /api/v1/courses/:id` (Auth: College Admin, Faculty, Student)
- `PATCH /api/v1/courses/:id` (Auth: College Admin)

#### 3.3.3. Subjects (`/api/v1/subjects`)
- `GET /api/v1/subjects`
  - **Auth:** College Admin, Faculty, Student
  - **Query:** `courseId=<ID>`, `semester=3`, `page=1`, `limit=50`
  - **Response `200 OK`:** Paginated array of `Subject` objects.
- `POST /api/v1/subjects`
  - **Auth:** College Admin
  - **Request Body:** `{ "departmentId": "6715...", "courseId": "6715...", "name": "Data Structures and Algorithms", "code": "CS301", "semester": 3, "credits": 4, "facultyLeadUserId": "6715..." }`
  - **Response `201 Created`**
- `GET /api/v1/subjects/:id` (Auth: College Admin, Faculty, Student)
- `PATCH /api/v1/subjects/:id` (Auth: College Admin)

#### 3.3.4. Laboratories (`/api/v1/laboratories`)
- `GET /api/v1/laboratories`
  - **Auth:** College Admin, Faculty, Student
  - **Query:** `subjectId=<ID>`, `departmentId=<ID>`, `page=1`, `limit=20`
  - **Response `200 OK`:** Paginated array of `Laboratory` objects.
- `POST /api/v1/laboratories`
  - **Auth:** College Admin
  - **Request Body:** `{ "departmentId": "6715...", "courseId": "6715...", "subjectId": "6715...", "name": "Data Structures Lab", "code": "CS301L", "location": "Computing Lab 3, Block C", "capacity": 35, "safetyProtocolRef": "STD-SAFETY-IT-01" }`
  - **Response `201 Created`**
- `GET /api/v1/laboratories/:id` (Auth: College Admin, Faculty, Student)
- `PATCH /api/v1/laboratories/:id` (Auth: College Admin)

#### 3.3.5. Experiments (`/api/v1/experiments`)
- `GET /api/v1/experiments`
  - **Auth:** College Admin, Faculty, Student (Students only receive `status=published`)
  - **Query:** `laboratoryId=<ID>`, `status=published`, `topicTag=binary_search_tree`, `page=1`, `limit=20`
  - **Response `200 OK`:** Paginated array of `Experiment` objects.
- `POST /api/v1/experiments`
  - **Auth:** Faculty, College Admin
  - **Request Body:**
    ```json
    {
      "departmentId": "6715...",
      "courseId": "6715...",
      "subjectId": "6715...",
      "laboratoryId": "6715...",
      "title": "Implementation and Analysis of Balanced Binary Search Trees",
      "code": "EXP-04",
      "description": "Construct an AVL self-balancing tree, implement rotations, and measure rebalance cost.",
      "objectives": [
        "Understand AVL tree rotation operations",
        "Implement left and right balance factors",
        "Verify O(log N) lookup under skewed insertion"
      ],
      "equipment": ["Linux/Windows Workstation", "GCC / Clang C++ Compiler", "GDB Debugger"],
      "prerequisites": ["Basic Binary Trees", "Pointers and Dynamic Allocation"],
      "safetyInstructions": ["Save workspace before recursion depth testing"],
      "procedureSteps": [
        {
          "stepNumber": 1,
          "title": "Define Node and Balance Factor",
          "instruction": "Declare struct Node with integer key, left/right pointers, and height scalar.",
          "expectedObservation": "Compilation succeeds without alignment padding errors.",
          "requiredApparatus": ["Compiler"],
          "verificationType": "observation_check"
        }
      ],
      "approvedResourceIds": ["6715..."],
      "estimatedDurationMins": 90,
      "topicTags": ["trees", "avl", "algorithms"]
    }
    ```
  - **Response `201 Created`**
- `GET /api/v1/experiments/:id` (Auth: College Admin, Faculty, Student)
- `PATCH /api/v1/experiments/:id` (Auth: Faculty author, College Admin)
- `POST /api/v1/experiments/:id/publish` (Auth: Faculty author, College Admin; transitions status to `published`)

---

### 3.4. Users & Role Management APIs
Base path: `/api/v1/users`

#### `GET /api/v1/users`
- **Description:** List institutional users filtered by role or department.
- **Authorization:** College Admin (for own tenant), Platform Admin (cross-tenant)
- **Query Parameters:** `role=student`, `departmentId=<ID>`, `status=active`, `page=1`, `limit=25`
- **Response `200 OK`:** Paginated array of `User` objects (with `passwordHash` strictly excluded).

#### `POST /api/v1/users`
- **Description:** Onboard a new institutional user (faculty, student, or college admin).
- **Authorization:** College Admin
- **Request Body:**
  ```json
  {
    "name": "Aarav Sharma",
    "email": "aarav.sharma@apex.edu",
    "password": "SecurePassword123!",
    "role": "student",
    "departmentId": "6715...",
    "profile": {
      "studentIdNumber": "REG-2024-042",
      "enrolledCourseIds": ["6715..."]
    }
  }
  ```
  *(Note: Password is hashed server-side with bcrypt/argon2 before storage into `passwordHash`; plaintext password is never persisted).*
- **Response `201 Created`**

#### `GET /api/v1/users/:id`
- **Description:** Get user profile details.
- **Authorization:** Self, College Admin, or Faculty (for enrolled students).

#### `PATCH /api/v1/users/:id`
- **Description:** Update user profile, contact details, or account status.
- **Authorization:** Self (profile fields only), College Admin (role, department, status).

---

### 3.5. Learning Resources APIs
Base path: `/api/v1/resources`

#### `POST /api/v1/resources`
- **Description:** Register metadata and cloud storage references for a course document or lab manual.
- **Authorization:** Faculty, College Admin
- **Request Body:**
  ```json
  {
    "departmentId": "6715...",
    "courseId": "6715...",
    "subjectId": "6715...",
    "laboratoryId": "6715...",
    "experimentId": "6715...",
    "title": "Official Laboratory Manual: AVL Trees & Self-Balancing Structures",
    "description": "Faculty approved procedural instructions, pseudocode, and rubric.",
    "category": "manual",
    "format": "PDF",
    "storageKey": "tenants/apex-eng/courses/cs301/manuals/avl_manual_v1.pdf",
    "storageBucket": "prod-genai-lab-manuals",
    "mimeType": "application/pdf",
    "fileSizeBytes": 2457600,
    "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
- **Response `201 Created`:** Returns `LearningResource` object with `ragIndexingStatus: "pending"`.

#### `GET /api/v1/resources`
- **Description:** Query available learning resources for a lab or course.
- **Authorization:** College Admin, Faculty, Student (Students only see resources attached to enrolled labs).
- **Query:** `experimentId=<ID>`, `category=manual`, `ragIndexingStatus=ready`, `page=1`, `limit=20`

#### `GET /api/v1/resources/:id`
- **Description:** Get resource metadata. Presigned download URLs are generated on-demand by the backend service.

---

### 3.6. Assessments & Attempts APIs

#### 3.6.1. Assessments (`/api/v1/assessments`)
- `POST /api/v1/assessments`
  - **Auth:** Faculty
  - **Request Body:**
    ```json
    {
      "experimentId": "6715...",
      "type": "initial_diagnostic",
      "title": "Pre-Lab Diagnostic: AVL Tree Rotation Mechanics",
      "description": "Baseline concept readiness check prior to workbench access.",
      "passingScorePercent": 60,
      "timeLimitMins": 15,
      "questions": [
        {
          "questionId": "Q1",
          "topicTag": "tree_balance_factor",
          "prompt": "What is the balance factor of a node whose left subtree height is 3 and right subtree height is 1?",
          "options": [
            { "optionId": "A", "text": "-2" },
            { "optionId": "B", "text": "+2" },
            { "optionId": "C", "text": "0" },
            { "optionId": "D", "text": "+1" }
          ],
          "correctOptionId": "B",
          "explanation": "Balance factor = height(left) - height(right) = 3 - 1 = +2.",
          "difficulty": "intermediate",
          "weight": 1
        }
      ]
    }
    ```
  - **Response `201 Created`**
- `GET /api/v1/assessments/experiment/:experimentId`
  - **Auth:** Faculty, Student (For students, `correctOptionId` and `explanation` are stripped from response before submission).

#### 3.6.2. Assessment Attempts (`/api/v1/assessments/attempts`)
- `POST /api/v1/assessments/:assessmentId/start`
  - **Auth:** Student
  - **Description:** Starts a new timed assessment attempt; initializes attempt record in database.
  - **Response `201 Created`:** Returns `AssessmentAttempt` object (`status: "in_progress"`).
- `POST /api/v1/assessments/attempts/:attemptId/submit`
  - **Auth:** Student
  - **Request Body:**
    ```json
    {
      "answers": [
        { "questionId": "Q1", "selectedOptionId": "B", "timeSpentSeconds": 45 }
      ]
    }
    ```
  - **Description:** Evaluates responses, computes topic scores, determines scaffolding learning level (`beginner` | `intermediate` | `advanced`), and updates the student's `LearnerProfile` with empirical evidence.
  - **Response `200 OK`:** Returns evaluated attempt score, determined learning level, and topic breakdown.
- `GET /api/v1/assessments/attempts/student/:studentId`
  - **Auth:** Self student, Faculty, College Admin

---

### 3.7. Learner Profiles & Workbench Sessions APIs

#### 3.7.1. Learner Profile (`/api/v1/learners/profile`)
- `GET /api/v1/learners/profile`
  - **Auth:** Student (returns own profile with topic-specific proficiencies and evidence history).
- `GET /api/v1/learners/profile/:studentId`
  - **Auth:** Faculty, College Admin (evaluates student readiness and interventions).

#### 3.7.2. Learning Sessions (`/api/v1/learning-sessions`)
- `POST /api/v1/learning-sessions/start`
  - **Auth:** Student
  - **Request Body:**
    ```json
    {
      "experimentId": "6715...",
      "laboratoryId": "6715...",
      "assignedScaffoldingLevel": "intermediate"
    }
    ```
  - **Response `201 Created`:** Persistent session record with step tracker initialized.
- `PATCH /api/v1/learning-sessions/:id/step`
  - **Auth:** Student
  - **Request Body:**
    ```json
    {
      "stepNumber": 1,
      "status": "completed",
      "observationRecorded": "Tree height after 5 insertions matches expected height of 3.",
      "verificationPassed": true
    }
    ```
  - **Response `200 OK`**
- `POST /api/v1/learning-sessions/:id/ai-query`
  - **Auth:** Student
  - **Request Body:** `{ "stepNumber": 1, "queryPrompt": "Why did my balance factor become -2 after inserting 45?" }`
  - **Response `200 OK`:** Grounded AI tutor guidance with citations (recorded in session history).
- `POST /api/v1/learning-sessions/:id/complete`
  - **Auth:** Student
  - **Request Body:** `{ "finalObservations": "Completed all 5 procedure steps successfully." }`
  - **Response `200 OK`**

---

### 3.8. Help Requests & Escalation APIs
Base path: `/api/v1/help-requests`

#### `POST /api/v1/help-requests`
- **Description:** Student escalates an issue from the workbench directly to the instructor.
- **Authorization:** Student
- **Request Body:**
  ```json
  {
    "experimentId": "6715...",
    "experimentTitle": "Implementation of Balanced Binary Search Trees",
    "learningSessionId": "6715...",
    "stepNumber": 3,
    "studentQuery": "Segmentation fault during double left-right rotation at line 84. Need assistance checking pointer swap order.",
    "aiSuggestedContext": "Student query involves AVL double rotation logic. Previous AI suggestion recommended checking root->left->right child reassignment.",
    "escalationReason": "complex_query"
  }
  ```
- **Response `201 Created`**

#### `GET /api/v1/help-requests`
- **Description:** List help requests. Faculty sees requests for their subjects; students see their own.
- **Authorization:** Faculty, College Admin, Student
- **Query:** `status=pending_review`, `experimentId=<ID>`, `page=1`, `limit=20`

#### `PATCH /api/v1/help-requests/:id/respond`
- **Description:** Faculty provides guided feedback or resolves the escalation.
- **Authorization:** Faculty, College Admin
- **Request Body:**
  ```json
  {
    "facultyResponse": "Inspect line 82: ensure you update the parent height before calculating the balance factor of the pivot node.",
    "status": "resolved"
  }
  ```
- **Response `200 OK`**

---

### 3.9. Audit Logs API
Base path: `/api/v1/audit-logs`

#### `GET /api/v1/audit-logs`
- **Description:** Query immutable security and administrative event ledger.
- **Authorization:** Platform Admin (system-wide), College Admin (scoped strictly to own `institutionId`). Faculty and students are strictly forbidden (`403 Forbidden`).
- **Query Parameters:**
  - `targetDomain=auth` | `academic` | `curriculum` | `assessment` | `safety`
  - `status=success` | `failure` | `flagged`
  - `actorEmail=faculty@apex.edu`
  - `startDate=2026-10-01`
  - `endDate=2026-10-20`
  - `page=1`, `limit=50`
- **Response `200 OK`:** Paginated array of sanitized `AuditLog` records (passwords and tokens omitted by schema policy).

---

## 4. Architectural Boundaries for Phase 3A

1. **Schema & Contract Phase:** This document defines the formal API contracts, routing schemas, input validation standards, and authorization expectations for Phase 3A.
2. **No Mock APIs:** In accordance with project governance, mock API handlers, fake login routes, or simulated AI answers are strictly prohibited.
3. **Execution Sequence:**
   - **Phase 3A:** Database models, schema constraints, indexes, and API specifications.
   - **Phase 3B (Next):** Authentication controllers, JWT/session signing, RBAC middleware, and `/api/v1` route mounting.
