import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const SCRIPT_PATH = path.resolve("skills/memory-write/scripts/memory-write.sh");

test("memory-write escapes quotes in YAML descriptions", () => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-memory-md-write-"));

  execFileSync("bash", [SCRIPT_PATH, "create", memoryDir, "quote.md", 'value "quoted"'], {
    stdio: "pipe",
  });

  const content = fs.readFileSync(path.join(memoryDir, "quote.md"), "utf8");
  assert.match(content, /^description: "value \\"quoted\\""$/m);
});
