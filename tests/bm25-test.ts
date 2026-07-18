import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import nodejieba from "nodejieba";
import { bm25SearchDocs, bm25SearchMemoryFiles } from "../bm25.js";
import { createTempDir, writeText } from "./test-helpers.js";

test("bm25SearchDocs falls back when the loaded tokenizer throws", async (t) => {
  const cutForSearch = t.mock.method(nodejieba, "cutForSearch", () => {
    throw new Error("native binding unavailable");
  });
  const docs = [
    {
      id: "preferences",
      content: "用户偏好 暗色主题",
      data: { path: "core/user/preferences.md" },
    },
  ];

  const first = await bm25SearchDocs(docs, "用户偏好");
  const second = await bm25SearchDocs(docs, "用户偏好");

  assert.equal(first[0]?.data.path, "core/user/preferences.md");
  assert.equal(second[0]?.data.path, "core/user/preferences.md");
  assert.equal(cutForSearch.mock.callCount(), 1);
});

test("bm25SearchMemoryFiles indexes raw content when frontmatter is malformed", async () => {
  const tempDir = createTempDir("pi-memory-md-bm25-malformed");
  const filePath = path.join(tempDir, "old.md");
  writeText(
    filePath,
    [
      "---",
      "description: Old malformed memory",
      "tags:",
      "  - old-memory",
      "broken: [unterminated",
      "---",
      "",
      "# Recoverable body",
    ].join("\n"),
  );

  const results = await bm25SearchMemoryFiles([{ filePath, scope: "project" }], "recoverable body", 1);

  assert.equal(results[0]?.path, filePath);
});
