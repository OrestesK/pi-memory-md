---
name: memory-init
description: Initialize memory repository - clone git repo and create directory structure. Use when you need to set up pi-memory-md for the first time or initalize project's memory files.
---

## Overview

Run [scripts/memory-init.sh](scripts/memory-init.sh) to initialize the configured memory root as a local Git repository, optionally sync a configured remote, and create the project memory directory.

## Prerequisites

Before running this skill, ensure:

- Package installed: `pi install npm:pi-memory-md`
- Settings configured with `memoryDir.localPath` or `localPath`
- `repoUrl` is optional and enables remote clone/pull; without it, initialization remains local-only

## Execution Steps

### Step 1: Run Initialization Script

Execute the initialization script: [scripts/memory-init.sh](scripts/memory-init.sh)

The script will:

1. Read trusted memory settings from `$PI_CODING_AGENT_DIR/settings.json`; project settings are intentionally ignored for memory-root and remote configuration.
2. Initialize `localPath` as a local Git repository when `repoUrl` is absent.
3. Clone or pull when `repoUrl` is configured.
4. Preserve existing memory files and create `<project>/core/project/` when missing.
5. Create the configured `globalMemory` directory when present, without populating default USER/TASK files.

### Step 2: Create Additional Folders (Optional)

Ask user whether they want to create any additional folders beyond `core/project`.

Examples:

- `reference/`
- `archive/`
- Any custom project-specific folder

If YES, ask for the folder names and create them under the project memory directory.

### Step 3: Verify Setup

Call `memory_check` tool to verify setup is correct.

## Memory Repository Structure

```
{localPath}/
├── .git/
├── {globalMemory}/            # optional; created only when configured
└── {project-name}/
    └── core/
        └── project/           # project memory files
```

## Workflow Guide

```
START
  │
  ▼
Read configured localPath and optional repoUrl
  │
  ├─ repoUrl configured ──► clone or pull
  │
  └─ no repoUrl ──────────► initialize local Git repository
  │
  ▼
Preserve existing files and ensure <project>/core/project/
  │
  ▼
Optionally create user-selected project folders
  │
  ▼
Verify with memory_check
  │
  ▼
DONE
```

## Error Handling

| Error | Solution |
| ------- | ---------- |
| `settings not found` | Configure `pi-memory-md` in settings file |
| `Permission denied` | Check local-path permissions or SSH access when `repoUrl` is configured |
| `Directory exists but not git` | This error applies only to remote-backed mode; resolve the local directory deliberately before retrying |
| `Connection timeout` | Check network access for the configured remote |

## Scripts

- [scripts/memory-init.sh](scripts/memory-init.sh) — Initialize memory repository (clone repo, create minimal directories)
