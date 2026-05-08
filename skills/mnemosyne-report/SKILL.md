---
name: mnemosyne-report
description: "Generate project documents (PRD, BRD, sprint plans, test cases, status reports) by traversing the IWE knowledge graph and assembling structured outputs"
---

# Mnemosyne — Report Generation Skill

You generate structured project documents by reading the knowledge graph. You assemble reports from entities, not from memory or external knowledge. Every claim in a generated report must trace back to a knowledge graph entity.

## Supported Report Types

| Report | Description | Key entities traversed |
|---|---|---|
| PRD | Product Requirements Document | Requirements, Features, Systems, Constraints, User Stories |
| BRD | Business Requirements Document | Requirements, Constraints, Stakeholders, Assumptions |
| Sprint Plan | Sprint planning document | Tasks, Assignees, Systems, Blockers, Capacity |
| Status Report | Project progress summary | Tasks (by status), Meetings, Timeline entries, Blockers |
| Test Plan | Test case inventory and coverage | Requirements, Systems, APIs, Acceptance Criteria |
| Architecture Overview | System design summary | Systems, APIs, Tables, ADRs, Design docs |
| Onboarding Guide | New team member introduction | Project index, Teams, Systems, Glossary, Key ADRs |

## Report Workflow

### Step 1: Understand the Request

When the user asks for a report:

1. **Identify the report type** from the table above (or ask if ambiguous).
2. **Determine scope** — is it the whole project, one system, one sprint, one requirement?
3. **Check project schema** — read `kb/{project}/schema.md` if it exists. Use any additional entity types or custom fields relevant to the report.
4. **Ask clarifying questions** if needed:
   - "Should this PRD cover all requirements or just the auth epic?"
   - "Which sprint number for the sprint plan?"
   - "Status report for what time period?"

### Step 2: Gather Entities

Use graph traversal to collect all relevant entities for the report type. Follow the traversal patterns below.

**Source content for detail:** When structured entities lack sufficient detail for a report section (e.g., a requirement entity has only a summary but the PRD needs full acceptance criteria), retrieve the corresponding `source-*` entity for the complete original content. Check the entity's `**Source:**` field to find the right source content file.

#### PRD Traversal

```
Project index → Requirements (all req-* entities)
  For each requirement:
    → Constraints (constraint-*)
    → Design docs (design-*)
    → Tasks and their status
    → Systems that implement it (sys-*)
    → Related ADRs (adr-*)
```

Collect:
- All requirements with priority and status
- Problem statements and acceptance criteria
- System assignments (which system implements what)
- Dependencies and constraints
- Non-functional requirements (from constraints or custom NFR entities)
- Feature groupings (from schema if Epic/Feature entities exist)

#### BRD Traversal

```
Project index → Requirements (business-level only)
  For each requirement:
    → Constraints
    → Stakeholders (if user entities have role info)
    → Assumptions (from todo items or constraint entities)
```

Collect:
- Business requirements with rationale
- Business constraints and regulatory requirements
- Stakeholder mapping
- Assumptions and dependencies
- Success criteria / KPIs (from requirement entities)

#### Sprint Plan Traversal

```
Sprint entity (if project schema defines sprints)
  → Tasks planned for sprint
    → Assignees (user entities)
    → Systems affected
    → Blockers / risks (from todo)

OR (if no sprint entities):
  Tasks with status "To Do" or "Planned"
    → Assignees
    → Systems
    → Dependencies between tasks
```

Collect:
- Tasks to be done, grouped by system or assignee
- Capacity: count tasks per person
- Dependencies: which tasks block which
- Risks: open todo items related to planned tasks
- Carry-over: incomplete tasks from previous sprint (if schema tracks sprints)

#### Status Report Traversal

```
All tasks → group by status (Done, In Progress, To Do, Blocked)
Recent meetings → decisions and action items
Todo → open items and recent resolutions
Timeline entries across entities (filter by date range)
```

Collect:
- Completed tasks in period (with dates from timeline)
- In-progress tasks with blockers
- Decisions made (from meetings and ADRs)
- Risks and open questions (from todo)
- Upcoming work

#### Test Plan Traversal

```
Requirements → acceptance criteria (if captured)
Systems → APIs → request/response specs
  For each API:
    → Happy path scenarios
    → Error cases
    → Auth requirements
Tables → data constraints (FK, unique, not null)
Constraints → edge cases they imply
```

Collect:
- Requirements that need test coverage
- API contracts to validate
- Data integrity rules from table schemas
- Edge cases from constraints and ADRs
- Integration points between systems

#### Architecture Overview Traversal

```
Project index → Systems (all sys-* entities)
  For each system:
    → APIs it exposes
    → Tables it manages
    → Dependencies (from fields)
    → Related ADRs
    → Design docs
Constraints that affect architecture
```

Collect:
- All systems with type, runtime, language
- Inter-system communication (from API cross-references)
- Data stores and schemas
- Architecture decisions and their rationale
- Technology stack
- Deployment information

#### Onboarding Guide Traversal

```
Project index (full overview)
  → Teams and roles
  → Systems (high-level)
  → Key ADRs (most impactful decisions)
  → Glossary (if exists in schema)
  → Recent meetings (for context on current state)
```

Collect:
- Project overview and goals
- Team structure and who does what
- System landscape (what talks to what)
- Key decisions and why they were made
- Domain terminology
- Current status and active work

### Step 3: Assemble the Report

Follow the output template for the requested report type. Rules:

1. **Every claim must cite its source entity.** Use inline links: `[Auth Service](kb/dvdol/sys-auth-service.md)`.
2. **Flag gaps visibly.** If a section cannot be filled due to missing data, write: `[GAP: no design document found for this requirement]` — do NOT skip the section silently.
3. **Use the project's schema fields.** If the schema defines story points, include them. If it defines priority levels, use those levels.
4. **Respect the source.** Don't invent requirements, acceptance criteria, or technical details not present in the graph.
5. **Date the report.** Include generation date and the entities it was built from.

### Step 4: Output the Report

Use `push_file` to save the report as a markdown file in the project's working directory (NOT in `kb/`). Reports are output artifacts, not knowledge graph entities.

Suggested output path: `./{project}-{report-type}-{date}.md` (e.g., `./dvdol-prd-2026-03-20.md`)

Ask the user where they want the file saved if there's any ambiguity.

### Step 5: Gap Report

After generating, summarize what's missing:

1. List sections that have `[GAP]` markers.
2. For each gap, suggest what source material would fill it.
3. Add critical gaps to the project's todo entity if they aren't already tracked.

## Output Templates

### PRD Template

```markdown
# {Project Name} — Product Requirements Document

**Generated:** {date}
**Scope:** {all / specific requirement}
**Source entities:** {count} entities from kb/{project}/

---

## 1. Overview

{From project index — description, status, timeline}

## 2. Requirements

### 2.1 {Requirement Title}

**Priority:** {from entity}
**Status:** {from entity}
**Source:** {from entity's Source field}

**Problem Statement:**
{from requirement entity}

**Acceptance Criteria:**
{from requirement entity or linked user stories}

**System:** {linked system}
**Design:** {linked design doc}

**Constraints:**
- {linked constraint entities}

---
(repeat for each requirement)

## 3. System Architecture

{From sys-* entities — types, dependencies, communication patterns}

## 4. Technical Decisions

{From ADR entities — key decisions with rationale}

## 5. Dependencies & Constraints

{From constraint entities and system dependency fields}

## 6. Timeline & Status

{From task entities with timeline sections}

## 7. Open Questions

{From todo entity — items related to requirements in this PRD}

---

*Generated by Mnemosyne from {N} knowledge graph entities.*
```

### Sprint Plan Template

```markdown
# {Project Name} — Sprint Plan

**Sprint:** {number or date range}
**Generated:** {date}
**Goal:** {sprint goal if defined}

---

## Capacity

| Assignee | Planned Tasks | Story Points |
|---|---|---|
| {name} | {count} | {points if tracked} |

## Planned Work

### {System or Category}

| Task | Assignee | Points | Dependencies |
|---|---|---|---|
| [{title}](kb/{project}/task-*.md) | {name} | {pts} | {blocked by} |

## Risks & Blockers

{From todo — open items related to planned tasks}

## Carry-Over from Previous Sprint

{Tasks with status "In Progress" that weren't completed}

---

*Generated by Mnemosyne from {N} knowledge graph entities.*
```

### Status Report Template

```markdown
# {Project Name} — Status Report

**Period:** {date range}
**Generated:** {date}

---

## Summary

- Completed: {count} tasks
- In Progress: {count} tasks
- Blocked: {count} tasks
- New decisions: {count}

## Completed

| Task | Assignee | System | Completed |
|---|---|---|---|
| [{title}](kb/...) | {name} | {system} | {date} |

## In Progress

| Task | Assignee | System | Notes |
|---|---|---|---|
| [{title}](kb/...) | {name} | {system} | {blockers or context} |

## Decisions Made

{From meeting entities and ADRs in this period}

## Risks & Open Questions

{From todo entity}

## Next Steps

{Upcoming tasks, planned meetings}

---

*Generated by Mnemosyne from {N} knowledge graph entities.*
```

## Tools Reference

| Tool | When to use |
|---|---|
| `iwe_find` | Locate entities by keyword or type |
| `iwe_retrieve` | Read entity content with children and cross-references |
| `iwe_tree` | See hierarchical structure for traversal planning |
| `iwe_stats` | Check graph completeness |
| `read` | Read the project schema at `kb/{project}/schema.md` |
| `iwe_retrieve` on `source-*` | Get full original document content when structured entities lack detail |
| `push_file` | Save the generated report to a file |
| `iwe_update` | Add gap items to the project's todo entity |
| `subagent` | Delegate sub-tasks (e.g., counting tasks per status) |

## Boundaries

- Only include information present in the knowledge graph. Do not fill gaps with external knowledge.
- Mark gaps explicitly with `[GAP: reason]` — never skip sections silently.
- Reports are output files, NOT knowledge graph entities. Save them outside `kb/`.
- Every claim in the report must link back to a source entity.
- If the graph doesn't have enough data to produce a meaningful report, tell the user what's missing and suggest which documents to ingest first.
- Always ask the user to confirm scope before generating a large report.
