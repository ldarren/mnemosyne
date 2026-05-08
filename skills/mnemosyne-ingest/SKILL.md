---
name: mnemosyne-ingest
description: "Ingest project documents (PDF, DOCX, images, VTT, Markdown, chat text) into a structured IWE knowledge graph with source tracking, project-local schema support, and gap detection"
---

# Mnemosyne — Ingestion Skill

You ingest project materials into a structured knowledge graph. Your job is to parse input, identify entities, and create or update documents in IWE following the conventions below.

## Input Handling

| Input type | How to read |
|---|---|
| Chat text | Already in context — use directly |
| `.md`, `.txt`, `.vtt` | Use the built-in `read` tool |
| `.pdf` | Use `parse_pdf` tool |
| `.docx` | Use `parse_docx` tool |
| `.png`, `.jpg`, `.jpeg` | Use `parse_image` tool |

## Source Document Tracking

Every entity MUST record where its information came from. This is critical for traceability — when someone asks "where did this requirement come from?" the answer must be in the entity.

**Convention:** Add a `**Source:**` field to every entity with the filename, page/section, and date of ingestion.

Format:
```
**Source:** filename.pdf, p.12 (ingested 2026-03-15)
```

For entities built from multiple sources, list all:
```
**Source:**
- requirements-v2.pdf, p.5 (ingested 2026-03-10)
- sprint-planning-2026-03-15.vtt, 14:30 (ingested 2026-03-16)
```

For chat text with no filename:
```
**Source:** user-provided text (ingested 2026-03-15)
```

For images:
```
**Source:** whiteboard-photo.png (ingested 2026-03-15)
```

When updating an entity with new information, APPEND the new source — never replace existing sources.

## Project-Local Schema

Before ingesting, check if the project has a schema override at `kb/{project}/schema.md`. If it exists, read it first. The schema file defines:

- Additional entity types beyond the base set
- Custom fields for base entity types
- Project-specific naming conventions
- Relationship patterns specific to the project domain

If no `schema.md` exists AND this is the first ingestion for the project, run the **Project Initialization** flow (see Pass 0). If a schema exists, merge its definitions with the base — the schema extends, it does not replace.

## Directory Structure

The knowledge base uses subdirectories to separate projects:

```
kb/
  users/                <- shared (people exist across projects)
    joe-smith.md
    sarah-chen.md
  {project-name}/       <- one subdirectory per project
    schema.md           <- OPTIONAL: project-local entity schema
    index.md            <- project entry point
    sources.md          <- source document registry
    source-*.md         <- full content of ingested documents
    team-*.md
    adr-*.md
    req-*.md
    sys-*.md
    design-*.md
    todo.md
    task-*.md
    role-*.md
    api-*.md
    table-*.md
    constraint-*.md
    meeting-*.md
```

**Shared entities** (`users/`): people exist across projects.

**Project-scoped entities** (`{project}/`): everything else — `index`, `sources`, `source-*`, `schema`, `team`, `adr`, `req`, `design`, `task`, `sys`, `api`, `table`, `constraint`, `role`, `meeting`, `todo`.

When creating entities, always use the correct location. For project-scoped entities, the IWE key includes the project directory (e.g., `dvdol/req-sso-integration`, `dvdol/team-backend`). For shared entities, the key includes the shared directory (e.g., `users/joe-smith`).

Cross-directory links use relative paths:
- From a project subdir to users: `../users/joe-smith`
- From users to a project: `../dvdol/sys-auth-service`
- Between projects: `../other-project/req-search`

## Entity Types

**COMPLETENESS RULE: You MUST create an entity for every distinct item identified in the source material — no exceptions, no editorial filtering.** If a source document lists 99 meetings, create 99 meeting entities. If it mentions 12 tasks, create 12 task entities. If it names 7 people, create 7 user entities. You are a knowledge base, not a summarizer — your job is to painstakingly and faithfully record every detail. An entity with only a title and date is still a valid entity. Never skip items because they seem routine, trivial, or lacking detail. Do not invent information, but always create the entity with whatever information is available from the source.

Every entity is **one file**. Use `iwe_create` per entity with the full key path (e.g., `key: "dvdol/req-sso-integration"`, `key: "users/joe-smith"`). The content must include the `# Title` heading. Link entities using IWE inclusion links (link on its own line = parent-child hierarchy) and inline links (link within text = cross-reference).

### Source Registry

Key pattern: `{project}/sources`

Tracks all source documents ingested into this project. One entry per file. This allows the agent and user to trace any entity back to its original document.

```markdown
# Source Documents

| Filename | Type | Ingested | Full Content |
|---|---|---|---|
| requirements-v2.pdf | PDF | 2026-03-10 | [Full content](source-requirements-v2) |
| sprint-planning-2026-03-15.vtt | VTT | 2026-03-16 | [Full content](source-sprint-planning-2026-03-15) |
| architecture-diagram.png | Image | 2026-03-17 | [Full content](source-architecture-diagram) |
| PROJ-epic-auth.docx | DOCX | 2026-03-18 | [Full content](source-proj-epic-auth) |
```

Update this entity every time a new document is ingested. If it doesn't exist yet, create it on first ingestion. The "Full Content" column links to the `source-*` entity that holds the complete markdown conversion.

### Source Content

Key pattern: `{project}/source-{filename}` (project-scoped)

The **verbatim parsed output** of an ingested document. This is the raw text that the parsing tool (`parse_pdf`, `parse_docx`, `parse_image`, `read`) returned, written directly into a file without any summarization, reformatting, or editorial changes.

**THIS IS NOT A SUMMARY.** It is the complete, unedited output from the parser. If the PDF has 5 pages of content, the source file has 5 pages of content. If the meeting document has 14 detailed entries, the source file has all 14 with every detail preserved. You do not condense, you do not "capture the key points", you do not reformat into a shorter structure. You write it all.

Every ingested file gets a corresponding `source-*` entity. The content is the raw parser output with only a metadata header prepended.

| Original format | What to store |
|---|---|
| PDF, DOCX | The EXACT text output from `parse_pdf` / `parse_docx` — verbatim, complete, unedited |
| VTT, TXT | The EXACT file content as read by `read` — verbatim, complete, unedited |
| Image (PNG, JPG) | The EXACT description from `parse_image` — LLM's complete transcription of EVERYTHING visible: every word, label, number, spatial relationship, nothing omitted |

```markdown
# Source: coding-standards.pdf

**Original file:** coding-standards.pdf
**Type:** PDF (5 pages)
**Ingested:** 2026-03-12

## Content

### 1. Indentation

All PHP code must use 4-space indentation. No tabs.

### 2. Variable Naming

Variables use camelCase. Examples:
- `$orderQuantity` — stock order quantity
- `$bidPrice` — current bid price for a stock
- `$userAccountBalance` — user's account balance
- `$tradeExecutionTime` — timestamp of trade execution
- `$portfolioValue` — total portfolio value

### 3. Function Naming

Functions use camelCase with verb prefix:
- `getOrderById()`
- `calculatePortfolioValue()`
- `validateTradeRequest()`

...full document content continues...
```

For images, the source content captures the LLM's interpretation:

```markdown
# Source: architecture-whiteboard.png

**Original file:** architecture-whiteboard.png
**Type:** Image (PNG, 2.4MB)
**Ingested:** 2026-03-15

## Content

Whiteboard diagram showing three services connected via REST APIs:

### Services

1. **Auth Service** (labeled "Java/Spring")
   - Connected to "User DB" (PostgreSQL icon)
   - Exposes endpoint: /api/v1/auth/*

2. **Order Service** (labeled "Go")
   - Connected to "Order DB" (PostgreSQL icon)
   - Arrow to Auth Service labeled "token validation"
   - Arrow to Notification Service (dotted, labeled "future")

3. **API Gateway** (labeled "Node/Express")
   - Routes to both Auth and Order services
   - Label: "rate limiting here"

### Handwritten Notes

- "Redis for session cache?" (with question mark, top-right)
- "SLA: 99.9% for order path" (underlined, bottom)
- "Ask Joe about gRPC vs REST for internal" (circled)
```

**Rules:**
- Create one `source-*` entity per ingested file. Always.
- The content is the VERBATIM parser output. Do not summarize, condense, restructure, or skip anything. If the parser returned 10,000 words, write 10,000 words.
- For images: the `parse_image` output IS your transcription. Write it all — every label, every arrow, every handwritten note, every spatial relationship. If you can't read something, note it as `[illegible]`.
- Source content files are linked from the Source Registry but NOT from the project index (they would clutter the hierarchy).
- Structured entities (req-*, sys-*, task-*) are extracted FROM source content files. The `**Source:**` field on structured entities points back to the source content file.

### Project Index

Key pattern: `{project-name}/index`

The entry point for a project. Contains inclusion links to its children.

```markdown
# Project Name

Brief description of the project.

**Status:** Active
**Start date:** 2026-01-15
**Source:** project-charter.pdf, p.1 (ingested 2026-03-10)

## Teams

[Backend Team](team-backend)

[Frontend Team](team-frontend)

## Requirements

[SSO Integration](req-sso-integration)

[Payment Gateway](req-payment-gateway)

## Systems

[Auth Service](sys-auth-service)

[API Gateway](sys-api-gateway)

## ADRs

[ADR-001: SAML over OIDC](adr-001-saml-over-oidc)

## Tasks

[Setup CI Pipeline](task-setup-ci)

## Meetings

[Sprint Planning 2026-03-15](meeting-sprint-planning-2026-03-15)

## Sources

[Source Documents](sources)

## Todo

[Project Todo](todo)
```

Note: links to shared users use `../users/` prefix. All other links (teams, requirements, etc.) are relative within the same project directory.

### Team

Key pattern: `{project}/team-{name}` (project-scoped)

```markdown
# Backend Team

Brief description or charter.

**Source:** org-chart.pdf, p.3 (ingested 2026-03-10)

## Roles

[Tech Lead](role-backend-tech-lead)

[Developer](role-backend-developer)
```

### Role

Key pattern: `{project}/role-{team}-{title}` (project-scoped)

A role is a **job position or function** within a team — NOT a person. The key contains the position title (e.g., `role-backend-tech-lead`, `role-frontend-engineer`). A person who fills the role is linked via **Current assignee**.

**Do not** create a role entity for a person's name. If you have a person named "Jane Doe" who is a backend engineer, the role is `role-backend-engineer` and the user is `users/jane-doe`.

```markdown
# Tech Lead — Backend Team

**Description:** Leads technical decisions for the backend team.
**Current assignee:** [Joe Smith](../users/joe-smith)
**Source:** org-chart.pdf, p.3 (ingested 2026-03-10)
```

### User

Key pattern: `users/{name}` (shared, `users/` subdirectory)

A user is a **real person** identified by their human name — NOT a job title or role. The key contains the person's name (e.g., `users/joe-smith`, `users/jane-doe`).

**Do not** create a user entity for a job title. If you see "backend engineer" in the materials, that is a role (`{project}/role-backend-engineer`), not a user.

```markdown
# Joe Smith

**Email:** joe@example.com
**Description:** Senior engineer, 5 years at company.
**Source:** org-chart.pdf, p.3 (ingested 2026-03-10)

## Roles

[Tech Lead — Backend Team](../dvdol/role-backend-tech-lead)

## Tasks

[Setup CI Pipeline](../dvdol/task-setup-ci)

[SSO Integration Backend](../dvdol/task-sso-backend)
```

The Tasks section uses inclusion links to every task assigned to this user. The task details live on the task entity — do not duplicate them here. Links to project-scoped entities use `../` to go up from `users/` then into the project directory.

### Requirement

Key pattern: `{project}/req-{short-name}` (project-scoped)

```markdown
# SSO Integration

**Priority:** High
**Status:** In Progress
**Source:** requirements-v2.pdf, p.5 (ingested 2026-03-10)

## Problem Statement

Users must log in separately to each internal tool, causing friction and support tickets.

## Constraints

[Must Support SAML](constraint-must-support-saml)

## Design

[SSO Design](design-sso-integration)

## Tasks

[SSO Backend Implementation](task-sso-backend)

[SSO Frontend Widget](task-sso-frontend)
```

### Design

Key pattern: `{project}/design-{name}` (project-scoped)

```markdown
# SSO Design

**Source:** design-doc-sso.pdf, p.1-8 (ingested 2026-03-12)

Technical approach, architecture decisions, diagrams (as text).

Uses SAML 2.0 via the [Auth Service](sys-auth-service).
Implements [SSO Integration](req-sso-integration) requirement.
Decision rationale documented in [ADR-001](adr-001-saml-over-oidc).
```

Inline links within text create cross-references to related entities.

### Task

Key pattern: `{project}/task-{id-or-name}` — use Jira ticket ID when available (e.g., `task-PROJ-123`) (project-scoped)

```markdown
# Setup CI Pipeline

**Status:** In Progress
**Assignee:** [Joe Smith](../users/joe-smith)
**System:** [Auth Service](sys-auth-service)
**Source:** sprint-planning-2026-03-15.vtt, 14:30 (ingested 2026-03-16)

Short description of the task scope and acceptance criteria.

## Timeline

- 2026-03-10: Created, assigned to [Joe Smith](../users/joe-smith)
- 2026-03-15: Status changed to In Progress
- 2026-03-20: Blocked by infra access — see [todo](todo)
```

### System

Key pattern: `{project}/sys-{name}` (project-scoped)

Represents a software component, service, or application being built or integrated. Includes runtime and dependency information as fields — do not create separate entities for dependencies or infrastructure.

```markdown
# Auth Service

**Type:** Backend service
**Runtime:** AWS EKS, ap-southeast-1
**Language:** Java 21, Spring Boot 3.2
**Dependencies:** Okta SDK v4.x, Redis 7.x, PostgreSQL 16
**Source:** design-doc-sso.pdf, p.3 (ingested 2026-03-12)

Handles authentication and session management for all internal tools.
Implements the [SSO Integration](req-sso-integration) requirement.

## APIs

[Login](api-auth-login)

[Token Refresh](api-auth-token-refresh)

[Logout](api-auth-logout)

## Tables

[Users](table-users)

[Sessions](table-sessions)

## Tasks

[PROJ-123: Implement SAML flow](task-PROJ-123)

[PROJ-124: Session storage migration](task-PROJ-124)
```

### API

Key pattern: `{project}/api-{system}-{name}` (project-scoped)

Contracts between systems — endpoints, request/response shapes, auth requirements.

```markdown
# Auth Service — Login API

**Method:** POST
**Path:** /api/v1/auth/login
**Auth:** None (public)
**System:** [Auth Service](sys-auth-service)
**Source:** api-spec-v1.pdf, p.12 (ingested 2026-03-14)

## Request

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | yes | User email address |
| password | string | yes | User password |

## Response

| Field | Type | Description |
|---|---|---|
| access_token | string | JWT, expires in 15min |
| refresh_token | string | Opaque token, expires in 7d |

## Notes

Stores session in [Sessions](table-sessions) table.
Rate limited to 10 requests/minute per IP.
```

If the source material identifies an API endpoint, always create an entity for it — even if only the name or path is known. Fill in what you have and leave other fields blank. Do not invent details not present in the source.

### Table

Key pattern: `{project}/table-{name}` (project-scoped)

Database table schemas. One file per table.

```markdown
# Users Table

**Database:** PostgreSQL
**Schema:** auth
**System:** [Auth Service](sys-auth-service)
**Source:** design-doc-sso.pdf, p.6 (ingested 2026-03-12)

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| email | varchar(255) | unique, not null |
| hashed_password | varchar(255) | not null |
| created_at | timestamptz | not null, default now() |

Referenced by [Sessions](table-sessions) via `user_id` FK.
```

If the source material mentions a database table, always create an entity for it — even if only the table name is known. Fill in what you have (name, database, system). Do not invent column definitions not present in the source.

### ADR (Architecture Decision Record)

Key pattern: `{project}/adr-{number}-{short-name}` (project-scoped)

Captures technical decisions with context. ADRs are important for detecting decision drift — later designs or tasks contradicting earlier decisions.

```markdown
# ADR-001: SAML over OIDC

**Status:** Accepted
**Date:** 2026-02-10
**Deciders:** [Joe Smith](../users/joe-smith), [Sarah Chen](../users/sarah-chen)
**Source:** design-review-2026-02-10.vtt, 32:15 (ingested 2026-03-10)

## Context

Need to integrate SSO for [SSO Integration](req-sso-integration). Corporate identity provider only supports SAML 2.0.

## Decision

Use SAML 2.0 via Okta SDK. Rejected OIDC because the corporate IdP does not support it.

## Consequences

- Must handle XML parsing for SAML assertions
- Okta SDK dependency added to [Auth Service](sys-auth-service)
- Cannot use standard JWT-only flow
```

Create an ADR when the source material records a decision with rationale — even informally (e.g., "we decided in the meeting to go with X because Y"). If a decision is mentioned without rationale, create a todo item asking for the reasoning.

### Constraint

Key pattern: `{project}/constraint-{name}` (project-scoped)

Technical, business, or regulatory constraints that scope or limit the project.

```markdown
# Must Support SAML

**Type:** Technical
**Source:** corporate-it-policy.pdf, p.2 (ingested 2026-03-10)
**Applies to:** [SSO Integration](req-sso-integration)

The corporate identity provider only supports SAML 2.0. OIDC is not available.
This drives the decision in [ADR-001](adr-001-saml-over-oidc).
```

### Meeting

Key pattern: `{project}/meeting-{type}-{date}` (project-scoped)

Captures meetings with their decisions, action items, and attendees. This is critical for traceability — decisions and tasks often originate from meetings.

```markdown
# Sprint Planning — 2026-03-15

**Type:** Sprint Planning
**Date:** 2026-03-15
**Attendees:** [Joe Smith](../users/joe-smith), [Sarah Chen](../users/sarah-chen)
**Source:** sprint-planning-2026-03-15.vtt (ingested 2026-03-16)

## Agenda

- Review backlog for Sprint 5
- Assign tasks for auth service work
- Discuss blocker on infra access

## Decisions

- Prioritize [SSO Integration](req-sso-integration) over [Payment Gateway](req-payment-gateway) this sprint
- [Joe Smith](../users/joe-smith) to own [PROJ-123](task-PROJ-123)

## Action Items

- [ ] [Joe Smith](../users/joe-smith): Set up CI pipeline by 2026-03-20 → [task-setup-ci](task-setup-ci)
- [ ] [Sarah Chen](../users/sarah-chen): Draft design doc for payment gateway
- [ ] Team: Review [ADR-001](adr-001-saml-over-oidc) by next standup

## Notes

Joe expressed uncertainty about whether PROJ-123 scope includes mobile app. Added to [todo](todo).
```

Create a meeting entity for every meeting identified in the source material — no exceptions.

### Todo

Key pattern: `{project}/todo` (project-scoped)

One per project. Captures questions, doubts, risks, and gaps — both from your analysis and from the source materials.

```markdown
# Project Todo

## Open

- [ ] Joe expressed doubt about scope of [task-PROJ-123](task-PROJ-123) — "not sure if this includes the mobile app" (source: sprint-planning-2026-03-15.vtt, 14:30)
- [ ] No design doc found for [Payment Gateway](req-payment-gateway) — who owns this? (source: gap detection during ingestion of requirements-v2.pdf)
- [ ] [SSO Integration](req-sso-integration) has no tasks assigned to frontend team (source: gap detection)
- [ ] [Auth Service](sys-auth-service) lists Redis as dependency but no task covers Redis setup (source: gap detection)
- [ ] [ADR-001](adr-001-saml-over-oidc) references Okta SDK but no constraint captures the vendor lock-in risk (source: gap detection)

## Resolved

- [x] Clarified auth approach — SAML 2.0 confirmed in [SSO Design](design-sso-integration) (resolved 2026-03-18)
```

Each todo item should reference the related entity with an inline link and cite where the doubt came from (source document filename, speaker, approximate context).

### Timeline convention

Timeline entries are bullet points embedded in their parent entity under a `## Timeline` section. Format:

```
- YYYY-MM-DD: Description with [inline links](entity-key) to related entities
```

When a timeline section exceeds 50 items, extract it to a separate file using `iwe_extract` with section title "Timeline".

## Key Naming Conventions

### Shared entities

| Entity | Pattern | Example Key |
|---|---|---|
| User (person's name) | `users/{name}` | `users/joe-smith` |

### Project-scoped entities

| Entity | Pattern | Example Key |
|---|---|---|
| Project index | `{project}/index` | `dvdol/index` |
| Source registry | `{project}/sources` | `dvdol/sources` |
| Source content | `{project}/source-{filename}` | `dvdol/source-coding-standards` |
| Schema (optional) | `{project}/schema` | `dvdol/schema` |
| Team | `{project}/team-{name}` | `dvdol/team-backend` |
| Requirement | `{project}/req-{short-name}` | `dvdol/req-sso-integration` |
| Design | `{project}/design-{name}` | `dvdol/design-sso-integration` |
| Task | `{project}/task-{id-or-name}` | `dvdol/task-PROJ-123` |
| System | `{project}/sys-{name}` | `dvdol/sys-auth-service` |
| API | `{project}/api-{system}-{name}` | `dvdol/api-auth-login` |
| Table | `{project}/table-{name}` | `dvdol/table-users` |
| ADR | `{project}/adr-{number}-{short-name}` | `dvdol/adr-001-saml-over-oidc` |
| Constraint | `{project}/constraint-{name}` | `dvdol/constraint-must-support-saml` |
| Role (job position) | `{project}/role-{team}-{title}` | `dvdol/role-backend-tech-lead` |
| Meeting | `{project}/meeting-{type}-{date}` | `dvdol/meeting-sprint-planning-2026-03-15` |
| Todo | `{project}/todo` | `dvdol/todo` |

Keys are lowercase kebab-case. When a Jira ticket ID is available, prefer it (e.g., `task-PROJ-123`).

## Ingestion Workflow

### Pass 0: Setup

1. **Determine the target project** — ask the user which project this material belongs to if not obvious. Use the project directory name (e.g., `dvdol`).
2. **Check for project schema** — read `kb/{project}/schema.md` if it exists.
   - **If schema exists:** Use any additional entity types or custom fields defined there.
   - **If schema does NOT exist AND this is a new project (no `index.md`):** Run Project Initialization (see below).
   - **If schema does NOT exist but project already has entities:** Use only the base entity types. Suggest to the user that they can create a schema later.
3. **Record the source** — note the filename, type, and today's date. You will add this to the source registry and to every entity created.

#### Project Initialization (first-time only)

When creating a new project for the first time, ask the user these questions before proceeding with ingestion:

1. **Project name and short code** — What should the project directory be called? (e.g., `dvdol`, `stock-trading`)
2. **Methodology** — What development methodology does this project use?
   - Agile/Scrum (enables: Sprint, Epic, User Story, Velocity tracking)
   - Kanban (enables: board states, WIP limits)
   - Waterfall (enables: Phase, Milestone, Gate)
   - Hybrid / Other
3. **Task tracking** — Does the project use a tool like Jira, Linear, or similar? If yes, what is the ticket ID format? (e.g., `PROJ-123`)
4. **Domain-specific entities** — Are there domain-specific entity types this project needs? Examples:
   - Sprint, Epic, Risk, Defect (agile)
   - Phase, Milestone, Deliverable (waterfall)
   - Feature, User Story, Acceptance Criteria (product-focused)
   - Test Case, Test Plan (QA-heavy projects)
   - Glossary (domain with specialized terminology)
5. **Custom fields** — Any additional fields needed on base entities? (e.g., story points on tasks, priority levels, SLA on systems)

Based on the answers, generate `kb/{project}/schema.md` with the relevant additional entity types, then proceed with ingestion.

#### Schema File Format

The generated `schema.md` should follow this structure:

```markdown
# {Project Name} — Schema

**Methodology:** Agile/Scrum
**Task ID format:** PROJ-{number}

## Additional Entity Types

### Sprint

Key pattern: `{project}/sprint-{number}`

A time-boxed iteration of work.

Fields:
- **Goal:** sprint goal
- **Start date:** YYYY-MM-DD
- **End date:** YYYY-MM-DD
- **Status:** planned | active | completed
- **Velocity:** story points completed

Template:
` ` `markdown
# Sprint {N}

**Goal:** description
**Start date:** YYYY-MM-DD
**End date:** YYYY-MM-DD
**Status:** active
**Velocity:** (filled after sprint ends)
**Source:** filename (ingested date)

## Planned Work

[Task title](task-PROJ-123)

[Task title](task-PROJ-124)

## Outcomes

- Completed: X story points
- Carried over: [task](task-PROJ-125) — reason
` ` `

### Epic

Key pattern: `{project}/epic-{id-or-name}`

...additional entity types...

## Custom Fields

| Base Entity | Additional Field | Description |
|---|---|---|
| Task | **Story Points:** | Estimated complexity (1, 2, 3, 5, 8, 13) |
| Task | **Sprint:** | Link to sprint entity |
| Requirement | **Priority:** | Critical / High / Medium / Low |

## Relationship Patterns

- Epic → User Stories → Tasks (decomposition)
- Sprint → Tasks (planned work for iteration)
- Risk → Feature/Requirement it impacts
- Defect → Test Case that found it → System affected
```

### Pass 1: Extract and Create

1. **Parse the input** using the appropriate tool.
2. **Create source content file** — immediately create `{project}/source-{filename}` with the **verbatim parsed output** from the tool. Do NOT summarize, condense, reformat, or editorialize. Write the raw parsed text exactly as the tool returned it. For images, write out your complete description and transcription of everything visible — every word, every label, every number. This must happen BEFORE extracting entities. The source content file is a permanent record of what the parser produced — it is NOT your interpretation of it.
3. **Check existing graph** — run `iwe_find` to see what entities already exist. Do not create duplicates.
4. **Identify entities** — scan the content for projects, people, teams, tasks, requirements, systems, APIs, decisions, meetings, and anything that fits the entity types above (or the project schema).
5. **For each entity**, decide: create new (`iwe_create`) or update existing (`iwe_update`).
   - To update: first `iwe_retrieve` the current content, then merge new information into it.
   - **Update rule:** New information is additive. Append timeline entries, add new links, update status fields. Never silently remove existing content.
   - **Source rule:** Always include the `**Source:**` field. When updating, append the new source to existing ones.
   - **Conflicts:** If new information contradicts existing content (e.g., different assignee), update the current state AND add a timeline entry recording the change.
   - **Placement:** User entities go in `users/` subdirectory. Everything else (including teams) goes in the project subdirectory.
6. **Build hierarchy** — ensure parent entities include links to their children:
   - Project index → Teams, Requirements, Systems, ADRs, Tasks, Meetings, Sources, Todo
   - Team → Roles
   - Requirement → Constraints, Design, Tasks
   - System → APIs, Tables, Tasks
   - Meeting → (no children, but cross-references to decisions, tasks, users)
7. **Update source registry** — add an entry to `{project}/sources` for the document just ingested.
8. **Capture doubts and gaps** — run the gap detection rules below. Anything flagged gets added to the project's todo entity.

### Pass 2: Review and Fix

1. Run `iwe_tree` to see the full hierarchy.
2. Check for:
   - **Orphans** — entities not linked from any parent. Add the missing inclusion link.
   - **Missing entities** — did you skip a person mentioned by name? A system mentioned but not created?
   - **Broken cross-references** — inline links pointing to entities that don't exist yet.
   - **Wrong location** — user entity placed inside a project dir, or project entity placed in `users/`.
   - **Missing sources** — any entity without a `**Source:**` field.
3. Fix structural issues found. Add todo items for content gaps that require more information.
4. **Report to the user:** Summarize what was ingested — entities created, entities updated, and any items added to the todo.

### Pass 3: Closing Protocol

After reporting, surface related questions from the todo:

1. Collect the list of entity keys you created or updated in this session.
2. Use the `subagent` tool to delegate to the `todo-scanner` agent:
   - **agent:** `todo-scanner`
   - **task:** `Read the file at kb/{project}/todo.md. Find open items related to these entities: {comma-separated list of touched keys}. Return the top 5 most relevant questions.`
3. Present the returned questions to the user. Explain briefly why each is relevant to what was just ingested.
4. If the user answers any question:
   - Update the relevant entity with the new information.
   - Move the todo item from Open to Resolved in the todo file.

If no todo file exists yet (first ingestion), skip this step.

## Gap Detection Rules

Run these checks after creating or updating entities. For each gap found, add an item to the project's todo entity with an inline link to the relevant entity and a citation of why it's a gap.

### Project Management Gaps

- [ ] Requirement with no design
- [ ] Requirement with no tasks
- [ ] Task with no assignee
- [ ] Task with no status
- [ ] Person mentioned by name but no user entity exists
- [ ] Decision mentioned in a meeting or document without rationale — create a todo asking for an ADR
- [ ] Doubt or uncertainty expressed by anyone in the source material (e.g., "I'm not sure if...", "we need to confirm...")
- [ ] Action item or verbal commitment with no corresponding task ("I'll take care of that")
- [ ] Meeting action item with no due date or owner

### Technical Gaps

- [ ] System with no APIs defined
- [ ] System with no tasks linked
- [ ] API with no request/response spec
- [ ] Requirement with no system — which system implements this?
- [ ] Task with no system — which system does this task modify?
- [ ] ADR referenced by no design or task
- [ ] Constraint with no ADR explaining the decision behind it
- [ ] Dependency mentioned in a system but no task covers integration
- [ ] Design that contradicts an existing ADR

### How to Write Todo Items

Each todo item must:
- Start with `- [ ]`
- Reference the related entity with an inline link
- Cite the source (document filename, speaker, section)
- Be specific enough that someone can answer or resolve it

Good: `- [ ] No design doc for [Payment Gateway](req-payment-gateway) — requirement exists but no technical approach documented (source: requirements-v2.pdf, p.8)`

Bad: `- [ ] Missing information about payments`

## Tools Reference

| Tool | When to use |
|---|---|
| `parse_pdf` | Read PDF files |
| `parse_docx` | Read DOCX files |
| `parse_image` | Load PNG/JPG images for visual analysis |
| `read` | Read .md, .txt, .vtt files |
| `iwe_find` | Check if an entity exists before creating |
| `iwe_retrieve` | Read an entity's current content before updating |
| `iwe_create` | Create a new entity by key path (e.g., `dvdol/req-sso`) — one file per entity |
| `iwe_update` | Replace an entity's content (always retrieve first) |
| `iwe_delete` | Remove an entity |
| `iwe_tree` | Review hierarchy during Pass 2 |
| `iwe_stats` | Check graph size |
| `iwe_extract` | Split a large section (e.g., timeline > 50 items) into its own file |
| `iwe_rename` | Fix a key that doesn't follow conventions |
| `subagent` | Delegate focused tasks (e.g., todo scanning) to a sub-agent |

## Boundaries

- Only extract information present in the input. Do not invent entities, dates, or relationships.
- When information is ambiguous or missing, add a todo item instead of guessing.
- Do not resolve conflicting information silently — record both versions and add a todo.
- Create an entity for every item identified in the source — even if only partial information is available. Never skip items due to lack of detail.
- Every entity must have a `**Source:**` field. No exceptions.
- After ingestion, confirm to the user exactly what was created, updated, and flagged.
- Always end with the closing protocol — surface related todo questions to the user.
