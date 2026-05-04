# Mnemosyne

## Problem

RAG (Retrieval-Augmented Generation) is the standard approach for giving LLMs access to project knowledge. It works, but has well-known issues:

- **Vector similarity is fuzzy.** Embedding-based search retrieves "similar" chunks, not necessarily the right ones. A question about "auth service dependencies" might pull in chunks about "auth tokens" or "service mesh" instead.
- **Chunks lose structure.** Splitting documents into fixed-size chunks destroys the hierarchy. A requirement, its design, its tasks, and the ADR behind it are scattered across unrelated vectors.
- **No relationships.** Vector stores are flat. There is no way to traverse from a requirement to its tasks, or from a person to everything they own. You get isolated fragments.
- **Retrieval is invisible.** When the LLM answers, you can't easily verify which sources it used or trace back to the original context.

## Approach

Instead of vector similarity search, Mnemosyne uses a **graph knowledge base** made of plain markdown files.

The insight: LLMs are already good at reading files and writing markdown. A graph of linked markdown files is a retrieval structure that plays to the model's strengths — no embeddings, no vector DB, no chunking.

Each entity (requirement, system, task, person, decision, ...) is one `.md` file. Relationships are markdown links. The graph engine ([IWE](https://github.com/nickarner/iwe)) resolves links, tracks hierarchy (parent-child via inclusion links) and cross-references (inline links), and lets you traverse, search, and query the graph.

The result is a knowledge base that is:

- **Structured.** Entities have types, relationships are explicit, hierarchy is preserved.
- **Navigable.** Follow links from a requirement to its design to its tasks. Not keyword matching — graph traversal.
- **Human-readable.** It's just markdown files in a folder. Open them, browse them, edit them by hand.
- **Citable.** Every answer can link directly to the source file: `kb/dvdol/sys-auth-service.md`.

The catch: building and maintaining a graph knowledge base is tedious manual work. Mnemosyne solves this by using an **agent** to create and maintain the graph through natural language.

## Usage

Mnemosyne runs as a chat agent. You talk to it in natural language.

### Setup

You can either use a `.env` file to set up your LLM model access, or use AWS Bedrock without a `.env` file. See the [pi-ai documentation](https://github.com/badlogic/pi-mono/tree/main/packages/ai#environment-variables-nodejs-only) for details.

```bash
npm ci
brew install iwe
mkdir -p kb && cd kb && iwe init
cd ..
npm start
```

### Ingest documents

Give it files and it extracts entities into the knowledge graph:

```
> /mnemosyne-ingest

Here are the sprint planning notes from last week: /path/to/sprint-notes.pdf
```

Mnemosyne will:
1. Parse the PDF
2. Extract people, tasks, requirements, decisions, systems, etc.
3. Create entity files in `kb/` with proper links
4. Flag gaps and open questions in `kb/{project}/todo.md`
5. Surface related todo items for you to answer

It handles PDF, DOCX, VTT transcripts, markdown, and plain text.

```
> /mnemosyne-ingest

We decided in today's meeting to use PostgreSQL instead of DynamoDB for the session store.
Joe will own the migration. Target: end of Q2.
```

This creates/updates ADR, task, and user entities — and links them.

### Ask questions

Query the knowledge graph in natural language:

```
> /mnemosyne-query

What depends on the auth service?
```

```
> /mnemosyne-query

What tasks are assigned to Joe and still in progress?
```

```
> /mnemosyne-query

What are we missing for the SSO integration?
```

Answers cite source files directly (e.g., [Auth Service](kb/dvdol/sys-auth-service.md)) so you can click through and verify.

### Browse the knowledge base

The `kb/` directory is plain markdown. You can browse it in your editor, file manager, or any markdown viewer:

```
kb/
  users/
    joe-smith.md
    sarah-chen.md
  dvdol/
    index.md
    team-backend.md
    req-sso-integration.md
    sys-auth-service.md
    adr-001-saml-over-oidc.md
    task-setup-ci.md
    todo.md
```

You can also generate an interactive graph visualization:

```
> Can you visualize the knowledge graph?
```

This produces an HTML file with a navigable node graph.

## How it works

Mnemosyne is built on the [pi.dev](https://pi.dev) open-source stack:

| Component | Role |
|---|---|
| [pi-ai](https://github.com/nickarner/pi-ai) | LLM abstraction layer |
| [pi-agent](https://github.com/nickarner/pi-agent) | Agent runtime |
| [pi-coding-agent](https://github.com/nickarner/pi-coding-agent) | Extension API for tools, skills, and sub-agents |
| [IWE](https://github.com/nickarner/iwe) | File-based markdown graph engine |

### Architecture

Mnemosyne is a pi-coding-agent extension (`src/extension.ts`) that registers:

**2 skills** — prompt templates that guide the agent's behavior:

| Skill | Purpose |
|---|---|
| `mnemosyne-ingest` | Parse input, extract entities, build/update the graph, detect gaps |
| `mnemosyne-query` | Traverse the graph, answer questions, cite sources, flag missing info |

**4 tools** — capabilities the agent can invoke:

| Tool | Purpose |
|---|---|
| `parse_pdf` | Extract text from PDF files |
| `parse_docx` | Extract text from DOCX files |
| `iwe_*` (9 commands) | Graph operations: `find`, `retrieve`, `create`, `update`, `delete`, `tree`, `stats`, `extract`, `rename` |
| `iwe_visualize` | Generate interactive HTML graph visualization |

**1 sub-agent:**

| Agent | Purpose |
|---|---|
| `todo-scanner` | Lightweight agent (Haiku) that scans `todo.md` for open questions related to recently touched entities. Runs after every ingestion and query to surface relevant follow-ups. |

### Graph structure

The knowledge base uses IWE's link semantics:

- **Inclusion link** (markdown link on its own line) = parent-child hierarchy
- **Inline link** (link within a sentence) = cross-reference

```markdown
## Tasks

[Setup CI Pipeline](task-setup-ci)        ← inclusion: this is a child

**Assignee:** [Joe Smith](../users/joe-smith)  ← inline: cross-reference
```

Entity types: `index`, `team`, `req`, `design`, `task`, `sys`, `api`, `table`, `adr`, `constraint`, `role`, `todo`, `user`.

Users live in `kb/users/` (shared across projects). Everything else lives in `kb/{project}/`.

### IWE operations

The `iwe_*` tools map to IWE CLI commands. Key operations:

```bash
iwe find "auth"              # fuzzy search
iwe retrieve -k dvdol/sys-auth-service -d 2  # expand 2 levels of children
iwe tree -k dvdol/index      # show hierarchy from project root
iwe stats                    # document count, link count, broken links
```

`iwe_create` bypasses the CLI's `new` command (which doesn't support subdirectory keys) and writes files directly to the correct path.

## Setup

```bash
# install IWE
brew install nickarner/tap/iwe

# install dependencies
npm install

# initialize knowledge base (if starting fresh)
mkdir -p kb && cd kb && iwe init && cd ..

# run
npm start
```

## Development

```bash
# type-check
npx tsc --noEmit

# run tests
npm test

# watch mode
npm run test:watch
```

Tests use fixture-based IWE knowledge bases to verify graph structure rules (hierarchy, naming conventions, cross-directory links, orphan detection) without invoking the LLM.
