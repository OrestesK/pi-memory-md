# Local patch ledger

This working tree is based on upstream commit `2c6e1948f0a594bf904c5f9dcd92a16be96710d9`.

The local patch set is intentionally narrow. It preserves upstream's tool/skill split:

- `memory_search`, `memory_check`, and `memory_sync` remain native tools;
- `memory-write` remains a skill backed by native file tools and its helper script;
- no native `memory_write` tool is registered;
- `memory-search` and `memory-sync` are not exported as skills. Their upstream source directories remain packaged for reference, but the explicit `pi.skills` manifest does not load them.

## BM25 runtime resilience

`nodejieba` can import successfully while its first tokenizer call throws because the native binding is unavailable. Chinese normalization catches that runtime failure, caches the unavailable state, and uses the existing fallback tokenizer.

Memory search also catches invalid user-edited frontmatter and indexes the raw file content. It does not implement a second YAML parser or attempt to repair metadata.

## Full project-memory search

The native search tool retains upstream's default `scope: "project"`, but searches the complete selected project-memory directory rather than only `core/`. This keeps non-core reference memories discoverable on demand without auto-delivering them.

## Bounded session parsing

Tape/session lookup reads at most 64 KiB for a session header. Session files larger than 2 MiB are parsed from their latest 512 KiB of complete JSONL lines.

This bounds startup and session-bridge resource use. The tradeoff is that old entries in oversized session files are not returned by the tape parser; the underlying session files are unchanged.

## Memory workflow policy

`memory-write` performs durable-value and authority checks, then requires explicit confirmation of the exact target and summary before mutation. Substantial work alone does not justify a memory write.

`memory-init` does not offer USER/TASK templates or duplicate `AGENTS.md` preferences into memory files. `AGENTS.md` remains the authority for agent behavior and stable preferences, while TODO/TapeThread own current task state.

When `repoUrl` is absent, `memory-init` preserves existing files, initializes `localPath` as a local Git repository, and creates the project memory directory. A configured `repoUrl` retains upstream clone/pull behavior. Initialization never pushes.

Initialization reads memory-root and remote settings only from the trusted agent settings file, not project settings, and expands a leading `~/` without evaluating shell syntax.

`memory_sync status` checks the configured repository independently of the current project namespace, so inspecting Git state never requires creating an empty memory directory.

The write helper escapes double quotes and backslashes in YAML string values. A direct script regression test covers quoted descriptions.

## Non-mutating package check

`npm run check` does not run a formatter in write mode. It performs Biome validation and strict TypeScript checking without modifying the working tree. The bundled initialization and write helpers are kept `shellcheck`-clean and stable under the configured `shfmt` formatter.

## Validation

Run from `packages/pi-memory-md`:

```sh
npm test
npm run check
shellcheck skills/memory-write/scripts/memory-write.sh skills/memory-init/scripts/memory-init.sh
```
