---
name: mnemosyne-ingest
description: "Ingest project documents (PDF, DOCX, VTT, Markdown, chat text) into a structured IWE knowledge graph with defined entity types and conventions"
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

## Directory Structure

The knowledge base uses subdirectories to separate projects:

```
kb/
  users/                ← shared (people exist across projects)
    joe-smith.md
    sarah-chen.md
  {project-name}/       ← one subdirectory per project
    index.md            ← project entry point
    team-*.md           ← project-scoped
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
```

**Shared entities** (`users/`): people exist across projects.

**Project-scoped entities** (`{project}/`): everything else — `index`, `team`, `adr`, `req`, `design`, `task`, `sys`, `api`, `table`, `constraint`, `role`, `todo`.

When creating entities, always use the correct location. For project-scoped entities, the IWE key includes the project directory (e.g., `dvdol/req-sso-integration`, `dvdol/team-backend`). For shared entities, the key includes the shared directory (e.g., `users/joe-smith`).

Cross-directory links use relative paths:
- From a project subdir to users: `../users/joe-smith`
- From users to a project: `../dvdol/sys-auth-service`
- Between projects: `../other-project/req-search`

## Entity Types

Every entity is **one file**. Use `iwe_create` per entity with the full key path (e.g., `key: "dvdol/req-sso-integration"`, `key: "users/joe-smith"`). The content must include the `# Title` heading. Link entities using IWE inclusion links (link on its own line = parent-child hierarchy) and inline links (link within text = cross-reference).

### Project Index

Key pattern: `{project-name}/index`

The entry point for a project. Contains inclusion links to its children. Replaces the old `proj-*` pattern.

```markdown
# Project Name

Brief description of the project.

**Status:** Active
**Start date:** 2026-01-15

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

## Todo

[Project Todo](todo)
```

Note: links to shared users use `../users/` prefix. All other links (teams, requirements, etc.) are relative within the same project directory.

### Team

Key pattern: `{project}/team-{name}` (project-scoped)

```markdown
# Backend Team

Brief description or charter.

## Roles

[Tech Lead](role-backend-tech-lead)

[Developer](role-backend-developer)
```

Teams and roles live in the same project directory, so links are relative within the directory.

### Role

Key pattern: `{project}/role-{team}-{title}` (project-scoped)

A role is a **job position or function** within a team — NOT a person. The key contains the position title (e.g., `role-backend-tech-lead`, `role-frontend-engineer`). A person who fills the role is linked via **Current assignee**.

**Do not** create a role entity for a person's name. If you have a person named "Jane Doe" who is a backend engineer, the role is `role-backend-engineer` and the user is `users/jane-doe`.

```markdown
# Tech Lead — Backend Team

**Description:** Leads technical decisions for the backend team.
**Current assignee:** [Joe Smith](../users/joe-smith)
```

### User

Key pattern: `users/{name}` (shared, `users/` subdirectory)

A user is a **real person** identified by their human name — NOT a job title or role. The key contains the person's name (e.g., `users/joe-smith`, `users/jane-doe`).

**Do not** create a user entity for a job title. If you see "backend engineer" in the materials, that is a role (`{project}/role-backend-engineer`), not a user.

```markdown
# Joe Smith

**Email:** joe@example.com
**Description:** Senior engineer, 5 years at company.

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

Only create API entities when the source material provides enough detail (method, path, or request/response shape). If a document just mentions "the login endpoint" in passing, a cross-reference is sufficient — do not create a stub.

### Table

Key pattern: `{project}/table-{name}` (project-scoped)

Database table schemas. One file per table.

```markdown
# Users Table

**Database:** PostgreSQL
**Schema:** auth
**System:** [Auth Service](sys-auth-service)

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| email | varchar(255) | unique, not null |
| hashed_password | varchar(255) | not null |
| created_at | timestamptz | not null, default now() |

Referenced by [Sessions](table-sessions) via `user_id` FK.
```

Only create table entities when the source material explicitly describes schema. Do not invent column definitions.

### ADR (Architecture Decision Record)

Key pattern: `{project}/adr-{number}-{short-name}` (project-scoped)

Captures technical decisions with context. ADRs are important for detecting decision drift — later designs or tasks contradicting earlier decisions.

```markdown
# ADR-001: SAML over OIDC

**Status:** Accepted
**Date:** 2026-02-10
**Deciders:** [Joe Smith](../users/joe-smith), [Sarah Chen](../users/sarah-chen)

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
**Source:** Corporate IT policy
**Applies to:** [SSO Integration](req-sso-integration)

The corporate identity provider only supports SAML 2.0. OIDC is not available.
This drives the decision in [ADR-001](adr-001-saml-over-oidc).
```

### Todo

Key pattern: `{project}/todo` (project-scoped)

One per project. Captures questions, doubts, risks, and gaps — both from your analysis and from the source materials.

```markdown
# Project Todo

## Open

- [ ] Joe expressed doubt about scope of [task-PROJ-123](task-PROJ-123) — "not sure if this includes the mobile app" (source: sprint planning 2026-03-15)
- [ ] No design doc found for [Payment Gateway](req-payment-gateway) — who owns this?
- [ ] [SSO Integration](req-sso-integration) has no tasks assigned to frontend team
- [ ] [Auth Service](sys-auth-service) lists Redis as dependency but no task covers Redis setup
- [ ] [ADR-001](adr-001-saml-over-oidc) references Okta SDK but no constraint captures the vendor lock-in risk

## Resolved

- [x] Clarified auth approach — SAML 2.0 confirmed in [SSO Design](design-sso-integration)
```

Each todo item should reference the related entity with an inline link and cite where the doubt came from (source document, speaker, approximate context).

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
| Todo | `{project}/todo` | `dvdol/todo` |

Keys are lowercase kebab-case. When a Jira ticket ID is available, prefer it (e.g., `task-PROJ-123`).

## Ingestion Workflow

### Pass 1: Extract and Create

1. **Parse the input** using the appropriate tool.
2. **Determine the target project** — ask the user which project this material belongs to if not obvious. Use the project directory name (e.g., `dvdol`).
3. **Check existing graph** — run `iwe_find` to see what entities already exist. Do not create duplicates.
4. **Identify entities** — scan the content for projects, people, teams, tasks, requirements, systems, APIs, decisions, and anything that fits the entity types above.
5. **For each entity**, decide: create new (`iwe_create`) or update existing (`iwe_update`).
   - To update: first `iwe_retrieve` the current content, then merge new information into it.
   - **Update rule:** New information is additive. Append timeline entries, add new links, update status fields. Never silently remove existing content.
   - **Conflicts:** If new information contradicts existing content (e.g., different assignee), update the current state AND add a timeline entry recording the change.
   - **Placement:** User entities go in `users/` subdirectory. Everything else (including teams) goes in the project subdirectory.
6. **Build hierarchy** — ensure parent entities include links to their children:
   - Project index → Teams, Requirements, Systems, ADRs, Tasks, Todo
   - Team → Roles
   - Requirement → Constraints, Design, Tasks
   - System → APIs, Tables, Tasks
7. **Capture doubts and gaps** — run the gap detection rules below. Anything flagged gets added to the project's todo entity.

### Pass 2: Review and Fix

1. Run `iwe_tree` to see the full hierarchy.
2. Check for:
   - **Orphans** — entities not linked from any parent. Add the missing inclusion link.
   - **Missing entities** — did you skip a person mentioned by name? A system mentioned but not created?
   - **Broken cross-references** — inline links pointing to entities that don't exist yet.
   - **Wrong location** — user entity placed inside a project dir, or project entity placed in `users/`.
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
- Cite the source (document name, speaker, section)
- Be specific enough that someone can answer or resolve it

Good: `- [ ] No design doc for [Payment Gateway](req-payment-gateway) — requirement exists but no technical approach documented (source: ingestion of PRD-v2.pdf)`

Bad: `- [ ] Missing information about payments`

## Tools Reference

| Tool | When to use |
|---|---|
| `parse_pdf` | Read PDF files |
| `parse_docx` | Read DOCX files |
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
- Only create API and Table entities when the source material has enough detail. Do not create stubs.
- After ingestion, confirm to the user exactly what was created, updated, and flagged.
- Always end with the closing protocol — surface related todo questions to the user.
