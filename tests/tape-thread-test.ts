import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { TapeThreadStore } from "../tape/tape-thread.js";
import { createTempDir } from "./test-helpers.js";

test("TapeThreadStore creates, branches, checks out, searches, and replays", () => {
  const tapeDir = createTempDir("pi-memory-md-tape-thread");
  const store = new TapeThreadStore(tapeDir, "project");

  const thread = store.createThread("pi-memory-md tape mode", "anchor-thread");
  const root = store.createRootNode("anchor-root", "root summary", thread.thread.id);
  const branch = store.createBranch("checkout", "anchor-branch", "implement checkout", thread.thread.id);
  const secondRoot = store.createRootNode("anchor-root-2", "docs refresh", thread.thread.id);
  const threadLog = fs.readFileSync(path.join(tapeDir, "project__threads.jsonl"), "utf-8");
  const threadRecord = JSON.parse(threadLog.trim());
  const threadState = threadRecord["pi-memory-md tape mode"];
  assert.equal(threadState.thread.id, thread.thread.id);
  assert.equal(threadState.thread.anchorId, "anchor-thread");
  assert.deepEqual(threadState.thread.rootNodeIds, [root.head?.id, secondRoot.head?.id]);
  assert.equal(root.head?.id, "anchor-root");
  assert.equal(branch.head?.id, "anchor-branch");
  assert.equal(threadState.nodes.length, 3);
  assert.deepEqual(threadState.branches, [
    {
      name: "checkout",
      fromNodeId: root.head?.id,
      toNodeId: branch.head?.id,
    },
  ]);
  assert.deepEqual(threadState.tree, [
    {
      nodeId: root.head?.id,
      children: [
        {
          nodeId: branch.head?.id,
          children: [],
        },
      ],
    },
    {
      nodeId: secondRoot.head?.id,
      children: [],
    },
  ]);
  assert.doesNotMatch(threadLog, /active_thread_changed|head_updated|thread_updated|node_updated/);

  assert.equal(branch.thread.headNodeId, branch.head?.id);
  assert.equal(branch.head?.parentNodeId, root.head?.id);
  assert.equal(branch.head?.parentSummary, "root summary");
  assert.deepEqual(branch.head?.branchPath, ["root summary", "checkout"]);

  const checkedOut = store.checkout(root.head?.id ?? "", thread.thread.id);
  assert.equal(checkedOut.head?.id, root.head?.id);

  const replayed = new TapeThreadStore(tapeDir, "project");
  const status = replayed.status(thread.thread.id);
  assert.equal(status?.head?.id, root.head?.id);
  assert.equal(replayed.search("checkout").length, 1);

  const updated = replayed.updateHead(
    {
      decisionsAdd: ["Use per-thread state records"],
      nextAdd: ["Add docs", "Run tests"],
      nextRemove: ["Run tests"],
      filesAdd: ["tape/tape-thread.ts"],
      memoryAdd: ["core/project/tape.md"],
    },
    thread.thread.id,
  );
  assert.equal(updated.head?.summary, "root summary");
  assert.deepEqual(updated.head?.decisions, ["Use per-thread state records"]);
  assert.deepEqual(updated.head?.next, ["Add docs"]);
  assert.match(replayed.buildResumeContext(thread.thread.id), /Use per-thread state records/);
  assert.match(replayed.buildResumeContext(thread.thread.id), /tape\/tape-thread\.ts/);

  const escaped = replayed.updateHead({ summary: "Use <xml> & anchors" }, thread.thread.id);
  assert.equal(escaped.head?.summary, "Use <xml> & anchors");
  assert.match(replayed.buildResumeContext(thread.thread.id), /Use &lt;xml&gt; &amp; anchors/);

  const updatedLog = fs.readFileSync(path.join(tapeDir, "project__threads.jsonl"), "utf-8");
  const updatedRecord = JSON.parse(updatedLog.trim());
  assert.equal(updatedRecord["pi-memory-md tape mode"].nodes[0].summary, "Use <xml> & anchors");
  assert.equal(updatedRecord["pi-memory-md tape mode"].tree.length, 2);
  assert.doesNotMatch(updatedLog, /thread_updated|node_updated|head_updated|active_thread_changed/);

  replayed.archive(thread.thread.id);
  assert.equal(replayed.status(), null);
  assert.throws(() => replayed.updateHead({ nextAdd: ["Should fail"] }, thread.thread.id), /archived/);
  assert.equal(replayed.search().length, 0);
  assert.equal(replayed.search(undefined, true)[0]?.thread.status, "archived");
});

test("TapeThreadStore rejects invalid state records", () => {
  const tapeDir = createTempDir("pi-memory-md-tape-thread-empty");
  const store = new TapeThreadStore(tapeDir, "project");

  assert.throws(() => store.createThread("", "anchor-root"), /Thread name is required/);
  assert.throws(() => store.createThread("valid", ""), /Anchor id is required/);

  store.createThread("valid", "anchor-root");
  assert.throws(() => store.createThread("valid", "anchor-other"), /Thread already exists/);
});
