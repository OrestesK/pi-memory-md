---
name: memory-write
description: Create or update pi-memory-md memory files using the native write/edit tools plus the bundled template script. Use whenever writing, creating, or updating memory files.
---

# Memory Write

Use this skill to safely create or update pi-memory-md memory files while preserving valid frontmatter.

## Eligibility and approval

Before proposing a write:

- Search existing memory and identify the recurring future question the record would answer.
- Verify factual claims against current source, tests, configuration, explicit current user input, or another authoritative source.
- Write only durable, reusable knowledge that is materially expensive to rediscover and is not already authoritative in `AGENTS.md`, source, or repository documentation.
- Reject chronology, session summaries, raw logs, transient status, secrets, copied implementation prose, and one-off details recoverable from source or git.

Substantial work alone does not justify a memory. A request to remember something authorizes a proposal, not the mutation: show the exact target and a concise content summary, then obtain explicit user confirmation before creating or updating a memory file.

## Workflow

### 1. Find the memory directory

Use [scripts/memory-write.sh](scripts/memory-write.sh) to resolve the project memory directory. Use the printed path as `<memory-dir>`.

**Critical:** DO NOT CREATE, UPDATE, or WRITE any memory file until `<memory-dir>` has been resolved and verified by [scripts/memory-write.sh](scripts/memory-write.sh).

### 2. Create a new memory file

Before creating a memory file, infer a proposed relative path, description, and tags from the user's request, present them with a concise content summary, and ask for explicit final confirmation. User-provided path or metadata values are proposal inputs; they do not replace final write confirmation.

Use [scripts/memory-write.sh](scripts/memory-write.sh) to create the file template. The script prints the created absolute file path. Read or edit that file next.

### 3. Update an existing memory file

1. Use `read` on the existing file.
2. Use `edit` for targeted body changes when possible.
3. Preserve existing YAML frontmatter.
4. Refresh `updated` with [scripts/memory-write.sh](scripts/memory-write.sh).

If a full rewrite is necessary, include the complete frontmatter and body in native `write`, then refresh `updated`.

## Placement rules

- Put always-needed context under `core/`.
- Put project-specific auto-delivered memories under `core/project/`.
- Use root-level folders like `docs/`, `archive/`, `research/`, or `references/` for non-core references.
- Never create a root-level `project/` folder; use `core/project/`.

## Frontmatter shape

The script creates:

```yaml
---
description: "Human-readable description"
tags:
  - "tag"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
---
```
