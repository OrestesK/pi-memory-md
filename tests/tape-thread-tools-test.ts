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
  const threadStore = {
    createThread: () => status,
    status: () => status,
    createRootNode: () => status,
    createBranch: () => status,
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

  return { tools, createdAnchors };
}

test("TapeThread anchor creation is blocked in manual mode without slash command", async () => {
  const { tools, createdAnchors } = createHarness({ tape: { anchor: { mode: "manual" } } });
  const createTool = tools.get("tape_thread_create");
  assert.ok(createTool);

  const result = await createTool.execute("call-1", { name: "demo" });

  assert.match((result as any).content[0].text, /disabled when tape\.anchor\.mode="manual"/);
  assert.equal((result as any).details.disabled, true);
  assert.equal(createdAnchors.length, 0);
});

test("TapeThread slash command marks created anchors as manual", async () => {
  const { tools, createdAnchors } = createHarness({ tape: { anchor: { mode: "manual" } } }, () => "manual");
  const createTool = tools.get("tape_thread_create");
  assert.ok(createTool);

  await createTool.execute("call-1", { name: "demo" });

  assert.deepEqual(createdAnchors[0], {
    id: "anchor-1",
    name: "thread/demo",
    type: "thread",
    meta: { summary: "demo", purpose: "thread", trigger: "manual" },
  });
});
