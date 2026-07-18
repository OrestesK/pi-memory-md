import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createTempDir, writeJson, writeText } from "./test-helpers.js";

const SCRIPT_PATH = path.resolve("skills/memory-init/scripts/memory-init.sh");

test("memory-init creates a local git repository without repoUrl and preserves existing files", () => {
  const tempDir = createTempDir("pi-memory-md-init-local-git");
  const projectDir = path.join(tempDir, "project");
  const agentDir = path.join(tempDir, "agent");
  const memoryRoot = path.join(tempDir, "memory-root");
  const projectOverrideRoot = path.join(tempDir, "project-override-root");
  const existingFile = path.join(memoryRoot, "project", "core", "project", "existing.md");
  fs.mkdirSync(projectDir, { recursive: true });
  writeText(existingFile, "existing memory\n");
  writeJson(path.join(agentDir, "settings.json"), {
    "pi-memory-md": {
      memoryDir: { localPath: memoryRoot },
    },
  });
  writeJson(path.join(projectDir, ".pi", "settings.json"), {
    "pi-memory-md": {
      memoryDir: { localPath: projectOverrideRoot },
    },
  });

  execFileSync("bash", [SCRIPT_PATH], {
    cwd: projectDir,
    env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
    stdio: "pipe",
  });

  assert.equal(fs.readFileSync(existingFile, "utf8"), "existing memory\n");
  assert.equal(fs.existsSync(path.join(memoryRoot, ".git")), true);
  assert.equal(fs.existsSync(path.join(memoryRoot, "project", "core", "project")), true);
  assert.equal(fs.existsSync(projectOverrideRoot), false);
});

test("memory-init treats localPath as data instead of evaluating shell substitution", () => {
  const tempDir = createTempDir("pi-memory-md-init-literal-path");
  const projectDir = path.join(tempDir, "project");
  const agentDir = path.join(tempDir, "agent");
  const markerPath = path.join(projectDir, "injected-marker");
  const literalMemoryRoot = path.join(tempDir, "memory-$(touch injected-marker)");
  fs.mkdirSync(projectDir, { recursive: true });
  writeJson(path.join(agentDir, "settings.json"), {
    "pi-memory-md": {
      memoryDir: { localPath: literalMemoryRoot },
    },
  });

  execFileSync("bash", [SCRIPT_PATH], {
    cwd: projectDir,
    env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
    stdio: "pipe",
  });

  assert.equal(fs.existsSync(markerPath), false);
  assert.equal(fs.existsSync(path.join(literalMemoryRoot, ".git")), true);
});
