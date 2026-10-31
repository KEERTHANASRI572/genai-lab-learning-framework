# Technical Architecture & System Design

**Project:** Generative AI Framework for Personalized Laboratory Learning Environments  
**Document Status:** Planned System Architecture (Implementation Pending)  
**Target Delivery:** Enterprise Deployable Multi-Tenant Web Platform  

---

## 1. Overview & Architectural Principles

The **Generative AI Framework for Personalized Laboratory Learning Environments** is engineered to provide higher education institutions with an intelligent, pedagogically grounded, and secure laboratory assistant platform. 

### Core Design Principles:
1. **Production-Ready & Deployable:** Designed from inception for horizontal scalability, enterprise security, and cloud deployment—strictly avoiding prototype, demo, or mock-based shortcuts.
2. **Defensive Separation of Concerns:** Strict decoupling between the interactive client layer, the application orchestration backend, persistent storage tiers, and AI inference services.
3. **Multi-Tenant Isolation by Design:** Zero cross-tenant data leakage across database records, raw file assets, and vector embeddings.
4. **Pedagogical Grounding via RAG:** Generative responses must be anchored directly in authorized course documents and laboratory safety protocols, preventing unchecked hallucinations.
5. **Least Privilege & Role-Based Security:** Every API surface and data domain is bound to strict role-based access rules.

---

## 2. Distinction: Planned Architecture vs. Current State

| Component / Layer | Current State | Planned Production Architecture |
|---|---|---|
| **Frontend** | Implemented foundation (`frontend/`): React 19 + TypeScript + Vite, responsive AppShell, 35+ role views (Platform Admin, College Admin, Faculty, Student, Auth, Shared), Design System, live backend health status indicator. | Full-stack data integration, live WebSockets, real auth session flow, rich lab visualizations. |
| **Backend** | Implemented baseline (`backend/`): Node.js + TypeScript + Express, health endpoints (`/api/health`, `/api/health/ready`), centralized error handling, CORS. | Full multi-tenant RBAC routers, business controllers, RAG orchestrator, grading pipelines. |
| **Application DB** | Connected & Implemented: 14 Mongoose schemas (`Institution`, `Department`, `Course`, `Subject`, `Laboratory`, `Experiment`, `User`, `LearningResource`, `LearnerProfile`, `Assessment`, `AssessmentAttempt`, `LearningSession`, `HelpRequest`, `AuditLog`) with tenant isolation compound indices, schema validation, and sensitive field redaction. | Production transaction sessions, dynamic tenant database routing if requested. |
| **Object Storage** | Not configured | S3-Compatible Cloud Object Storage (Tenant-scoped buckets/paths) |
| **Vector Store** | Not configured | Persistent Vector Store (Atlas Vector Search, Pinecone, or Qdrant) |
| **LLM Gateway** | Not configured | Server-side LLM client with adapter pattern & guardrails |
| **RBAC & Auth** | Implemented (Phase 3B): Bcrypt password hashing, HS256 JWT tokens with single-use refresh rotation, `authenticate`, `requireRole`, `tenantResolver`, and `requireTenantScope` middleware enforcing multi-tenant isolation. Provisioning CLI script for platform administrator. | Institutional SAML/OAuth2 SSO integrations, dynamic tenant certificate rotation. |

> **API Specifications:** See [`docs/API_CONTRACTS.md`](API_CONTRACTS.md) for endpoint paths, payload schemas, pagination models, and role permissions.  
> **Research Foundation:** See [`docs/RESEARCH_INVESTIGATION.md`](RESEARCH_INVESTIGATION.md) for the scientific hypotheses, prior-art positioning, and multi-signal joint conditioning framework of the Evidence-Driven Adaptive Laboratory Learning Engine.

---

## 3. Planned Component Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT LAYER                                         |
|                                                                                         |
|   React + TypeScript + Vite SPA                                                         |
|   +-------------------+  +-------------------+  +-----------------+  +--------------+   |
|   | Student Lab Portal|  | Faculty Dashboard |  |  College Admin  |  | Platform Admin|  |
|   +-------------------+  +-------------------+  +-----------------+  +--------------+   |
+--------------------------------------------|--------------------------------------------+
                                             | HTTPS / WSS
+--------------------------------------------v--------------------------------------------+
|                                  APPLICATION LAYER                                      |
|                                                                                         |
|   Node.js + TypeScript + Express Backend                                                |
|   +---------------------------------------------------------------------------------+   |
|   | API Gateway & Request Routers                                                   |   |
|   +---------------------------------------------------------------------------------+   |
|   | Middleware: AuthN (JWT), Tenant Resolver, RBAC Guard, Rate Limiting, Audit Log |   |
|   +---------------------------------------------------------------------------------+   |
|   | Service Layer:                                                                  |   |
|   |  - Tenant & User Service         - Lab Curriculum & Session Service             |   |
|   |  - Document Ingestion Service    - RAG Retrieval & Vector Pipeline              |   |
|   |  - LLM Prompt & Guardrail Engine - Assessment & Telemetry Service               |   |
|   +---------------------------------------------------------------------------------+   |
+----------|-------------------------|------------------------|-----------------------|---+
           |                         |                        |                       |
           v                         v                        v                       v
+---------------------+   +---------------------+   +--------------------+   +--------------------+
| PERSISTENT DB       |   | OBJECT STORAGE      |   | VECTOR STORE       |   | SERVER-SIDE LLM    |
|                     |   |                     |   |                    |   |                    |
| MongoDB Atlas       |   | Cloud Object Store  |   | Vector Database    |   | AI Provider Gateway|
| - Tenant Accounts   |   | (S3/GCS/Azure)      |   | (Atlas Vector/     |   | - Model Adapters   |
| - Users & Roles     |   | - Lab Manuals (PDF) |   |  Pinecone/Qdrant)  |   | - Prompt Templates |
| - Courses & Labs    |   | - Schematics & Data |   | - Chunk Embeddings |   | - Token Controls   |
| - Student Records   |   | - Student Submissions|  | - Tenant Metadata  |   | - Content Safety   |
| - Audit Logs        |   | - Presigned URLs    |   | - Semantic Indices |   | - Guardrails       |
+---------------------+   +---------------------+   +--------------------+   +--------------------+
```

### 3.1. Frontend: React + TypeScript + Vite
- **Technology:** React, TypeScript, Vite as build tool.
- **Role in Platform:** Delivers responsive, low-latency single-page application interfaces tailored to user roles.
- **Key Modules:**
  - *Student Workbench:* Real-time laboratory experiment viewer, interactive AI tutor chat, step verification, observation notepad, and report generator.
  - *Faculty Management Suite:* Lab manual upload and syllabus authoring, experiment step configuration, custom RAG rule definitions, grading rubric builder, and student progress oversight.
  - *College Administrator Console:* Department hierarchy management, faculty/student roster onboarding, license tracking, and institutional usage analytics.
  - *Platform Administrator Console:* Global tenant provisioning, system health monitoring, AI provider metrics, and audit log analysis.
- **Architectural Rules:** No AI API keys or direct database connections may ever be compiled into or executed from the client bundle. All actions communicate strictly with the Express backend over authenticated endpoints.

### 3.2. Backend: Node.js + TypeScript + Express
- **Technology:** Node.js (v20+ LTS), TypeScript, Express.
- **Role in Platform:** Serves as the central API gateway, security perimeter, and business logic coordinator.
- **Architectural Design:**
  - Modular, layered architecture: `Routes -> Controllers -> Services -> Repositories`.
  - Type-safe request validation and response serialization.
  - Centralized error-handling middleware preventing internal stack trace disclosure.
  - Structured audit logging capturing security-critical actions and model interactions.
  - Background task processing for asynchronous document chunking and vector embedding generation.

### 3.3. Application Data: MongoDB Atlas
- **Technology:** MongoDB Atlas (Managed Cloud Document Database).
- **Role in Platform:** Persistent, transactional datastore for structured application entities.
- **Primary Schemas:**
  - `Institutions` (Tenants): Name, domain, active subscription, custom policies, encryption settings.
  - `Users`: Identity, email, role, tenant affiliation (`institutionId`), profile.
  - `Courses` & `LabModules`: Course metadata, syllabus, experiment procedures, safety rules.
  - `LabSessions`: Active student lab runs, recorded observations, step completion timestamps.
  - `Interactions`: Logs of student queries, retrieved context IDs, AI guidance responses, and faculty feedback flags.
  - `AuditEvents`: Immutable security and administrative event ledger.
- **Indexing & Performance:** Compound indices prefixed with `institutionId` across all collections to enforce tenant query locality and query speed.

### 3.4. Document Storage: Persistent Cloud Object Storage
- **Technology:** Persistent S3-compatible cloud object storage (e.g., AWS S3, Google Cloud Storage, or Azure Blob Storage).
- **Role in Platform:** Immutable storage for unstructured laboratory documents, faculty uploads, diagrams, and student submission artifacts.
- **Access Model:**
  - Private by default; public read access is explicitly prohibited.
  - Time-limited, cryptographically signed presigned URLs generated server-side for secure upload and retrieval.
  - Storage path partition structure enforcing multi-tenancy:
    `s3://<bucket>/tenants/{institutionId}/courses/{courseId}/manuals/{fileHash}.pdf`
    `s3://<bucket>/tenants/{institutionId}/students/{studentId}/submissions/{fileHash}.pdf`

### 3.5. Persistent Vector Store for RAG Retrieval
- **Technology:** Persistent Vector Database (MongoDB Atlas Vector Search, Pinecone, or Qdrant).
- **Role in Platform:** Stores high-dimensional dense vector embeddings of chunked laboratory manuals, protocol guidelines, safety data sheets, and equipment guides.
- **Ingestion & Indexing Pipeline:**
  1. Document uploaded to Object Storage.
  2. Server extracts raw text and structural components (tables, headers, procedures).
  3. Content chunked with semantic boundaries (e.g., 300–500 tokens with overlap).
  4. Embeddings generated via embedding model.
  5. Chunk embeddings stored in Vector Store with required metadata fields:
     - `institutionId` (Tenant partition - mandatory filter)
     - `courseId`
     - `labId`
     - `documentId`
     - `sourcePage`
- **Query Pipeline:** Student queries are embedded on the server and matched against vector indices using strict metadata filters to guarantee cross-tenant boundary isolation.

### 3.6. Server-Side LLM Integration
- **Technology:** Configurable server-side LLM provider (to be selected in Phase 5: e.g., Anthropic Claude, Google Gemini, OpenAI, or self-hosted open models).
- **Integration Approach:**
  - Unified Adapter Interface (`ILlmProvider`) abstracting provider-specific SDK differences.
  - Dynamic model selection based on task complexity (e.g., lightweight models for quick clarification, advanced models for complex analysis).
  - Server-side prompt templates with prompt-injection defense mechanisms.
  - System-level grounding instructions: Responses must cite retrieved document chunks; answers must refuse to generate hazardous procedural steps or bypass safety rules.
  - Token usage tracking and rate limits allocated per institution and per user.

---

## 4. Role-Based Access Control (RBAC) & Permissions

The platform enforces four explicit, non-overlapping administrative and operational roles:

| Role | Scope | Key Capabilities |
|---|---|---|
| **Platform Administrator** | System-Wide (Cross-Tenant) | - Provision and manage tenant institutions<br>- Monitor global health, platform telemetry, and system errors<br>- Configure global LLM providers, quotas, and service limits<br>- Inspect platform-level audit logs |
| **College Administrator** | Single Institution (`institutionId`) | - Manage departments, courses, and academic terms<br>- Provision and manage faculty and student user accounts<br>- Review institutional usage, storage consumption, and license quotas<br>- Configure institution-specific policies and integrations |
| **Faculty** | Department / Assigned Courses | - Upload and curate laboratory manuals, rubrics, and references<br>- Trigger and review document vectorization and RAG knowledge bases<br>- Configure experiment steps, verification milestones, and safety warnings<br>- Monitor student lab progress, AI interaction logs, and grades |
| **Student** | Enrolled Lab Sections | - Access assigned laboratory workbench and experiment instructions<br>- Engage with contextual AI assistant for real-time clarification<br>- Submit laboratory observations, measurements, and draft reports<br>- Review personalized formative feedback on experiment execution |

---

## 5. Multi-Tenancy & Institution-Level Data Isolation

Multi-tenancy is enforced at every layer of the architecture through **logical data isolation**:

1. **Context Resolution:**
   - Every incoming request presents an authenticated JWT containing the user's verified `institutionId`.
   - Backend middleware validates the token, extracts the tenant identifier, and attaches it to the immutable request context.
2. **Database Isolation:**
   - All MongoDB collections store `institutionId` as a required field.
   - All database queries, updates, and aggregations are scoped programmatically by the repository layer using `{ institutionId: req.tenantId, ... }`.
3. **Object Storage Isolation:**
   - Storage keys are prefixed with the tenant identifier (`/tenants/{institutionId}/...`).
   - Presigned URLs are only generated after verifying that the requesting user's `institutionId` matches the storage key's tenant prefix.
4. **Vector Retrieval Isolation:**
   - Vector similarity search queries are strictly bounded by hard metadata pre-filters:
     `{ filter: { institutionId: { $eq: req.tenantId }, courseId: { $in: userEnrolledCourses } } }`
   - Chunks belonging to Institution A can never be returned in a similarity search executed by a user from Institution B.

---

## 6. Security, Compliance & Governance

- **Zero Client Trust:** The client application is treated as untrusted. All input validation, role checks, and rate limits occur on the server.
- **Secret Management:** Secrets (API keys, database URIs, storage tokens) are strictly supplied through environment variables at runtime and must never be committed to source control.
- **Audit Logging:** Security-relevant operations (authentication events, role modifications, document deletions, and LLM query logs) are written to an append-only audit trail.
- **Prompt Injection & Safety Defenses:** User prompts are sanitized and combined with immutable system prompts and retrieved context; user input is never executed as control code.

---

## 7. Next Steps & Development Roadmap
 
The project development follows a structured phase-gate sequence:
1. **Phase 1 (Completed):** Workspace initialization, repository structure, and technical architectural specifications.
2. **Phase 2A & 2B (Completed):** Node.js + Express + TypeScript backend baseline, MongoDB Atlas cloud connection, readiness probes, and persistence verification.
3. **Phase 2C (Completed):** React 19 + TypeScript + Vite frontend client foundation, design system, responsive application shell, 35+ role views, and live backend health polling.
4. **Phase 3A (Completed):** MongoDB model design (14 production schemas with tenant-scoped validation and compound unique indices) and REST API contracts specification ([`docs/API_CONTRACTS.md`](API_CONTRACTS.md)).
5. **Phase 3B (Completed):** Multi-tenant authentication, password hashing (`bcryptjs`), JWT access & refresh token rotation, institutional tenant isolation middleware (`tenantResolver`, `requireTenantScope`), and role enforcement (`requireRole`). Platform Administrator provisioning utility.
6. **Phase 3C (Completed):** Production-ready core CRUD REST APIs (`/institutions`, `/departments`, `/courses`, `/subjects`, `/laboratories`, `/experiments`, `/users`) mounted on `/api/v1`, strict parent/child hierarchy validation, deny-by-default RBAC, fail-closed persistence on database disconnection, and frontend API service integration.
7. **Phase 4 (Next):** Cloud object storage pipeline (S3-compatible) and persistent vector database integration (Atlas Vector Search / Pinecone).
8. **Phase 5:** Server-side LLM provider integration, grounded RAG prompt synthesizer, safety guardrails, and citation verification.
9. **Phase 6:** Full-stack feature integration connecting frontend role views to backend APIs.
10. **Phase 7:** End-to-end testing, tenant boundary penetration audits, performance profiling, and production cloud deployment.
