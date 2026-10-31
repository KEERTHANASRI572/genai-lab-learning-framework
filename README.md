# Generative AI Framework for Personalized Laboratory Learning Environments

An enterprise-ready, multi-tenant educational framework designed to augment hands-on laboratory coursework with generative AI tutoring, retrieval-augmented generation (RAG) over experimental manuals, real-time procedural guidance, and automated assessment.

---

### Current Status: Core CRUD APIs & Multi-Tenant Persistence (Phase 3C) Complete

> **Notice:** The project has completed **Phase 1 (Workspace Foundation)**, **Phase 2A/2B (Backend Baseline & MongoDB Atlas Integration)**, **Phase 2C (Frontend Foundation & Role IA)**, **Phase 3A (Database Model Design & API Contracts)**, **Phase 3B (Secure Authentication & Multi-Tenant RBAC)**, and **Phase 3C (Core CRUD APIs & Multi-Tenant Persistence)**.
> Production-ready CRUD APIs for Institutions, Departments, Courses, Subjects, Laboratories, Experiments, and Users are mounted on `/api/v1` with deny-by-default RBAC, strict parent-child tenant validation, fail-closed database handling, and connected frontend screens with real loading/empty/error states.
> Verified via 22 CRUD & tenant isolation checks (`npm run test:crud`), 30 auth security checks (`npm run test:auth`), and 29 schema checks (`npm run test:models`).
> See [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) for endpoint contracts and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for technical specifications.

---

## Project Goal

Traditional laboratory curricula present significant challenges in student-to-instructor ratios, leading to bottlenecks during experiment execution, safety oversight, and post-lab analysis. 

The **Generative AI Framework for Personalized Laboratory Learning Environments** addresses this by providing:
- **Intelligent Experiment Scaffolding:** Grounded step-by-step assistance based strictly on faculty-approved laboratory manuals and protocols.
- **RAG-Driven Q&A:** A retrieval-augmented generation pipeline that answers theoretical and procedural lab questions without hallucinating beyond authorized course documents.
- **Role-Based Access Control (RBAC):** Distinct functional experiences for Platform Administrators, College Administrators, Faculty, and Students.
- **Strict Multi-Tenancy:** Complete data isolation across colleges and departments, guaranteeing privacy and compliance.
- **Real-World Deployability:** An architecture built for high availability, horizontally scalable workloads, and enterprise security standards.

---

## Planned Architecture Overview

The system is planned as a decoupled, multi-tiered cloud application:

```
[ Client Layer ]
  React + TypeScript + Vite (Role-specific SPAs: Student, Faculty, Admins)
       |
       v (HTTPS / REST / WebSocket)
[ Application Layer ]
  Node.js + TypeScript + Express (API Gateway, Auth, RBAC, Business Logic)
       |
       +---> [ Persistent Data Store ] : MongoDB Atlas (Users, Courses, Labs, Logs)
       +---> [ Object Storage ]       : S3-Compatible Cloud Storage (Lab Manuals, Media, Reports)
       +---> [ Vector Store ]         : Persistent Vector Database (Document Embeddings for RAG)
       +---> [ LLM Orchestrator ]     : Server-Side LLM Integration (Grounded Prompting & Safety)
```

For detailed architectural specifications, security considerations, and component contracts, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md).

---

## Repository Structure

```
genai-lab-learning-framework/
├── frontend/             # React 19 + TypeScript + Vite SPA client (Shell & 35+ role views)
├── backend/              # Node.js + TypeScript + Express REST API (Auth, RBAC, Models & Health)
│   ├── src/models/       # 14 Production-grade Mongoose models with validation & indexes
│   ├── src/middleware/   # Auth, RBAC, tenantResolver, and login abuse protection
│   └── src/controllers/  # Secure auth controller (login, refresh, me, logout)
├── docs/                 # System architecture, deployment guides, and design docs
│   ├── ARCHITECTURE.md   # Comprehensive technical architecture and component specs
│   ├── API_CONTRACTS.md  # Detailed REST API endpoint contracts and RBAC matrix
│   └── RESEARCH_INVESTIGATION.md # Research novelty, scientific hypotheses & evaluation protocol
├── .gitignore            # Standard git exclusion rules for Node/React/TypeScript
└── README.md             # Project overview and roadmap (this file)
```

---

## Phased Development Approach

To ensure enterprise stability and auditability, development follows a structured phase-gate approach:

| Phase | Milestone | Description | Status |
|---|---|---|---|
| **Phase 1** | **Foundation & Scaffolding** | Workspace initialization, git configuration, architectural blueprinting, and development standards. | **Completed** |
| **Phase 2A** | **Backend Baseline** | Node.js + TypeScript + Express server, health check endpoints, centralized error handling. | **Completed** |
| **Phase 2B** | **MongoDB Atlas Integration** | Secure Mongoose connection, readiness probes, persistence verification testing. | **Completed** |
| **Phase 2C** | **Frontend Foundation & IA** | React 19 + Vite + TypeScript application shell, design system, 35+ role views, responsive navigation. | **Completed** |
| **Phase 3A** | **Database Models & API Contracts** | 14 Mongoose models with tenant indexes and validation; `docs/API_CONTRACTS.md`. | **Completed** |
| **Phase 3B** | **Authentication & Multi-Tenant RBAC** | Password hashing (`bcryptjs`), JWT access & rotating refresh tokens, `tenantResolver`, `requireRole`. | **Completed** |
| **Phase 3C** | **Core CRUD APIs & Persistence** | Production-ready `/api/v1` endpoints for Institutions, Departments, Courses, Subjects, Labs, Experiments, Users; frontend service integration. | **Completed** |
| **Phase 4** | **Document Storage & Vector Ingestion** | Object storage pipeline for lab manuals, document extraction/chunking, embedding generation, and persistent vector store integration. | Planned |
| **Phase 5** | **RAG Pipeline & LLM Integration** | Server-side LLM provider orchestration, contextual prompt synthesis, guardrails, and citation verification. | Planned |
| **Phase 6** | **Full-Stack Feature Integration** | Wiring frontend views to live backend APIs, real-time lab workbench, and authoring tools. | Planned |
| **Phase 7** | **Hardening, Testing & Deployment** | End-to-end testing, tenant isolation verification, performance profiling, containerization, and production cloud deployment. | Planned |

---

## Getting Started

Implementation will commence with Phase 2. Ensure your development environment satisfies the upcoming prerequisites:
- **Node.js**: LTS version (v20+ recommended)
- **Package Manager**: npm or pnpm
- **TypeScript**: v5+
- **Database Access**: MongoDB Atlas cluster (to be configured in Phase 2)
- **Object Storage & Vector DB**: S3-compatible bucket and Vector DB instance (to be configured in Phase 4)

Refer to [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full architectural guidelines prior to contributing.
