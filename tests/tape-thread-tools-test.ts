import assert from "node:assert/strict";
import { test } from "node:test";
import { registerAllTapeThreadTools } from "../tape/tape-thread-tools.js";

function createHarness(settings: Record<string, unknown>, consumeThreadTrigger = () => null as "manual" | null) {
  const tools = new Map<string, { execute: (...args: unknown[]) => Promise<unknown> }>();
  const createdAnchors: unknown[] = [];
  const status = {
    thread: { id: "thread-id", name: "demo", status: "active" },
    path: [],
  };
  const calls: string[] = [];
  const threadStore = {
    createThread: () => {
      calls.push("createThread");
      return status;
    },
    status: () => status,
    createRootNode: () => {
      calls.push("createRootNode");
      return status;
    },
    createBranch: () => {
      calls.push("createBranch");
      return status;
    },
    checkout: () => {
      calls.push("checkout");
      return status;
    },
    updateHead: () => {
      calls.push("updateHead");
      return status;
    },
    archive: () => {
      calls.push("archive");
      return status.thread;
    },
    search: () => [status],
    buildResumeContext: () => "<tape_thread />",
  };
  const service = {
    createAnchor(name: string, type: string, meta?: unknown) {
      const anchor = { id: `anchor-${createdAnchors.length + 1}`, name, type, meta };
      createdAnchors.push(anchor);
      return anchor;
    },
    getThreadStore: () => threadStore,
  };

  registerAllTapeThreadTools(
    {
      registerTool: (tool: { name: string; execute: (...args: unknown[]) => Promise<unknown> }) =>
        tools.set(tool.name, tool),
    } as never,
    () => service as never,
    () => settings as never,
    consumeThreadTrigger,
  );

  return { tools, createdAnchors, calls };
}

test("TapeThread anchor creation is blocked in manual mode without slash command", async () => {
  const { tools, createdAnchors } = createHarness({ tape: { anchor: { mode: "manual" } } });
  const threadTool = tools.get("tape_thread");
  assert.ok(threadTool);

  const result = await threadTool.execute("call-1", { action: "create", name: "demo" });

  assert.match((result as any).content[0].text, /disabled when tape\.anchor\.mode="manual"/);
  assert.equal((result as any).details.disabled, true);
  assert.equal(createdAnchors.length, 0);
});

test("TapeThread slash command marks created anchors as manual", async () => {
  const { tools, createdAnchors } = createHarness({ tape: { anchor: { mode: "manual" } } }, () => "manual");
  const threadTool = tools.get("tape_thread");
  assert.ok(threadTool);

  await threadTool.execute("call-1", { action: "create", name: "demo" });

  assert.deepEqual(createdAnchors[0], {
    id: "anchor-1",
    name: "thread/demo",
    type: "thread",
    meta: { summary: "demo", purpose: "thread", trigger: "manual" },
  });
});

test("TapeThread non-mutating actions do not consume manual trigger", async () => {
  let manualAvailable = true;
  const { tools, createdAnchors } = createHarness({ tape: { anchor: { mode: "manual" } } }, () => {
    if (!manualAvailable) return null;
    manualAvailable = false;
    return "manual";
  });
  const threadTool = tools.get("tape_thread");
  assert.ok(threadTool);

  await threadTool.execute("call-1", { action: "status" });
  await threadTool.execute("call-2", { action: "search" });
  await threadTool.execute("call-3", { action: "resume" });
  await threadTool.execute("call-4", { action: "checkout", nodeId: "node-id" });
  await threadTool.execute("call-5", { action: "create", name: "demo" });

  assert.equal(createdAnchors.length, 1);
  assert.deepEqual((createdAnchors[0] as any).meta, { summary: "demo", purpose: "thread", trigger: "manual" });
});

test("TapeThread mutation actions are blocked in manual mode without slash command", async () => {
  const { tools, calls } = createHarness({ tape: { anchor: { mode: "manual" } } });
  const threadTool = tools.get("tape_thread");
  assert.ok(threadTool);

  for (const params of [
    { action: "create", name: "demo" },
    { action: "root", summary: "root" },
    { action: "branch", branchName: "next" },
    { action: "update", summary: "updated" },
    { action: "archive" },
  ]) {
    const result = await threadTool.execute("call", params);
    assert.equal((result as any).details.disabled, true);
  }

  assert.deepEqual(calls, []);
});
