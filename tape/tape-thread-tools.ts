import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { MemoryMdSettings } from "../types.js";
import { formatTimeSuffix } from "../utils.js";
import type { TapeService } from "./tape-service.js";
import type { TapeThreadNodePatch, TapeThreadStatusView } from "./tape-thread.js";
import type { RenderState } from "./tape-types.js";

type TapeServiceGetter = () => TapeService | null;
type TapeSettingsGetter = () => MemoryMdSettings;
type ThreadTrigger = "direct" | "manual";
type ConsumeThreadTrigger = () => "manual" | null;

function renderText(text: string): Text {
  return new Text(text, 0, 0);
}

function unavailableResult() {
  return { content: [{ type: "text" as const, text: "Tape runtime is unavailable." }], details: { unavailable: true } };
}

function threadAnchorBlockedResult(trigger: ThreadTrigger) {
  return {
    content: [
      {
        type: "text" as const,
        text: 'TapeThread anchor creation is disabled when tape.anchor.mode="manual" unless requested via /memory-thread.',
      },
    ],
    details: { disabled: true, handoffMode: "manual", allowedTriggers: ["manual"], trigger },
  };
}

function getResultText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content[0]?.text ?? "";
}

function formatThreadStatus(status: TapeThreadStatusView | null): string {
  if (!status) return "No active thread.";
  const path = status.path.map((node) => node.branchName ?? node.summary).join(" > ");
  return [
    `Thread: ${status.thread.name}`,
    `Status: ${status.thread.status}`,
    `HEAD: ${status.head?.id ?? "none"}`,
    `Path: ${path || "none"}`,
    status.head?.summary ? `Summary: ${status.head.summary}` : undefined,
    status.head?.parentNodeId ? `Parent: ${status.head.parentNodeId}` : undefined,
    status.head?.parentSummary ? `Parent summary: ${status.head.parentSummary}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSearchResults(results: TapeThreadStatusView[]): string {
  if (results.length === 0) return "No threads found.";
  return results
    .map((item) => {
      const head = item.head ? ` head=${item.head.id}` : "";
      const path = item.path.map((node) => node.branchName ?? node.summary).join(" > ");
      return `- ${item.thread.name} [${item.thread.status}]${head}\n  id=${item.thread.id}\n  path=${path || "none"}\n  summary=${item.head?.summary ?? ""}`;
    })
    .join("\n");
}

function createThread(tapeService: TapeService, name: string, summary?: string, trigger: ThreadTrigger = "direct") {
  if (!name) throw new Error("Thread name is required");
  const anchor = tapeService.createAnchor(`thread/${name}`, "thread", {
    summary: summary ?? name,
    purpose: "thread",
    trigger,
  });
  return tapeService.getThreadStore().createThread(name, anchor.id);
}

function branchThread(
  tapeService: TapeService,
  branchName: string,
  summary?: string,
  threadId?: string,
  trigger: ThreadTrigger = "direct",
) {
  if (!branchName) throw new Error("Branch name is required");
  const current = tapeService.getThreadStore().status(threadId);
  if (!current) throw new Error(threadId ? `Thread not found: ${threadId}` : "No active thread");
  const anchor = tapeService.createAnchor(
    `thread/${current.thread.name}-${branchName}-${formatTimeSuffix()}-[node]`,
    "thread",
    {
      summary: summary ?? branchName,
      purpose: "branch",
      trigger,
    },
  );
  return tapeService.getThreadStore().createBranch(branchName, anchor.id, summary, current.thread.id);
}

function createRootNode(
  tapeService: TapeService,
  summary: string,
  threadId?: string,
  trigger: ThreadTrigger = "direct",
) {
  if (!summary) throw new Error("Root node summary is required");
  const current = tapeService.getThreadStore().status(threadId);
  if (!current) throw new Error(threadId ? `Thread not found: ${threadId}` : "No active thread");
  const anchor = tapeService.createAnchor(`thread/${current.thread.name}-${formatTimeSuffix()}-[root-node]`, "thread", {
    summary,
    purpose: "root-node",
    trigger,
  });
  return tapeService.getThreadStore().createRootNode(anchor.id, summary, current.thread.id);
}

export function registerAllTapeThreadTools(
  pi: ExtensionAPI,
  getTapeService: TapeServiceGetter,
  getSettings: TapeSettingsGetter,
  consumeThreadTrigger: ConsumeThreadTrigger = () => null,
): void {
  pi.registerTool({
    name: "tape_thread_create",
    label: "Tape Thread Create",
    description: "Create a TapeThread",
    parameters: Type.Object({
      name: Type.String({ description: "Thread name" }),
      summary: Type.Optional(Type.String({ description: "Thread summary" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { name, summary } = params as { name: string; summary?: string };
      const trigger = consumeThreadTrigger() ?? "direct";
      if (getSettings().tape?.anchor?.mode === "manual" && trigger !== "manual")
        return threadAnchorBlockedResult(trigger) as never;
      const status = createThread(tapeService, name.trim(), summary?.trim(), trigger);
      return { content: [{ type: "text", text: formatThreadStatus(status) }], details: status };
    },
    renderCall(args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_create ")) + theme.fg("accent", args.name));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Creating thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_root",
    label: "Tape Thread Root",
    description: "Create a new top-level node in the current TapeThread",
    parameters: Type.Object({
      summary: Type.String({ description: "Root node summary" }),
      threadId: Type.Optional(Type.String({ description: "Thread id, defaults to active thread" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { summary, threadId } = params as { summary: string; threadId?: string };
      const trigger = consumeThreadTrigger() ?? "direct";
      if (getSettings().tape?.anchor?.mode === "manual" && trigger !== "manual")
        return threadAnchorBlockedResult(trigger) as never;
      const status = createRootNode(tapeService, summary.trim(), threadId?.trim(), trigger);
      return { content: [{ type: "text", text: formatThreadStatus(status) }], details: status };
    },
    renderCall(args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_root ")) + theme.fg("accent", args.summary));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Creating root node..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_branch",
    label: "Tape Thread Branch",
    description: "Create a branch node from the current thread HEAD",
    parameters: Type.Object({
      branchName: Type.String({ description: "Branch name" }),
      summary: Type.Optional(Type.String({ description: "Branch node summary" })),
      threadId: Type.Optional(Type.String({ description: "Thread id, defaults to active thread" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { branchName, summary, threadId } = params as { branchName: string; summary?: string; threadId?: string };
      const trigger = consumeThreadTrigger() ?? "direct";
      if (getSettings().tape?.anchor?.mode === "manual" && trigger !== "manual")
        return threadAnchorBlockedResult(trigger) as never;
      const status = branchThread(tapeService, branchName.trim(), summary?.trim(), threadId?.trim(), trigger);
      return { content: [{ type: "text", text: formatThreadStatus(status) }], details: status };
    },
    renderCall(args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_branch ")) + theme.fg("accent", args.branchName));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Branching thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_checkout",
    label: "Tape Thread Checkout",
    description: "Move thread HEAD to an existing node",
    parameters: Type.Object({
      nodeId: Type.String({ description: "Node id to checkout" }),
      threadId: Type.Optional(Type.String({ description: "Thread id" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { nodeId, threadId } = params as { nodeId: string; threadId?: string };
      const status = tapeService.getThreadStore().checkout(nodeId.trim(), threadId?.trim());
      return { content: [{ type: "text", text: formatThreadStatus(status) }], details: status };
    },
    renderCall(args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_checkout ")) + theme.fg("accent", args.nodeId));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Checking out thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_status",
    label: "Tape Thread Status",
    description: "Get compact current TapeThread context",
    parameters: Type.Object({ threadId: Type.Optional(Type.String({ description: "Thread id" })) }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { threadId } = params as { threadId?: string };
      const status = tapeService.getThreadStore().status(threadId?.trim());
      return { content: [{ type: "text", text: formatThreadStatus(status) }], details: status ?? {} };
    },
    renderCall(_args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_status")));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Loading thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_update",
    label: "Tape Thread Update",
    description: "Patch the current TapeThread HEAD summary, decisions, next tasks, files, or memory links",
    parameters: Type.Object({
      threadId: Type.Optional(Type.String({ description: "Thread id, defaults to active thread" })),
      summary: Type.Optional(Type.String({ description: "Updated HEAD summary" })),
      decisionsAdd: Type.Optional(Type.Array(Type.String(), { description: "Decisions to add" })),
      nextAdd: Type.Optional(Type.Array(Type.String(), { description: "Next tasks to add" })),
      nextRemove: Type.Optional(Type.Array(Type.String(), { description: "Next tasks to remove exactly" })),
      filesAdd: Type.Optional(Type.Array(Type.String(), { description: "Relevant files to add" })),
      memoryAdd: Type.Optional(Type.Array(Type.String(), { description: "Memory links to add" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { threadId, ...patch } = params as TapeThreadNodePatch & { threadId?: string };
      const status = tapeService.getThreadStore().updateHead(patch, threadId?.trim());
      return { content: [{ type: "text", text: formatThreadStatus(status) }], details: status };
    },
    renderCall(_args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_update")));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Updating thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_resume",
    label: "Tape Thread Resume",
    description: "Build compact resume context for a TapeThread",
    parameters: Type.Object({
      threadId: Type.Optional(Type.String({ description: "Thread id, defaults to active thread" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { threadId } = params as { threadId?: string };
      const context = tapeService.getThreadStore().buildResumeContext(threadId?.trim());
      return { content: [{ type: "text", text: context }], details: { context } };
    },
    renderCall(_args, theme) {
      return renderText(theme.fg("toolTitle", theme.bold("tape_thread_resume")));
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Building resume context..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_archive",
    label: "Tape Thread Archive",
    description: "Archive a TapeThread without deleting JSONL history",
    parameters: Type.Object({
      threadId: Type.Optional(Type.String({ description: "Thread id, defaults to active thread" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { threadId } = params as { threadId?: string };
      const thread = tapeService.getThreadStore().archive(threadId?.trim());
      return { content: [{ type: "text", text: `Archived thread: ${thread.name}` }], details: thread };
    },
    renderCall(args, theme) {
      return renderText(
        theme.fg("toolTitle", theme.bold("tape_thread_archive ")) + theme.fg("accent", args.threadId ?? "active"),
      );
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Archiving thread..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });

  pi.registerTool({
    name: "tape_thread_search",
    label: "Tape Thread Search",
    description: "Search threads; empty query lists recent threads",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Search query" })),
      includeArchived: Type.Optional(Type.Boolean({ description: "Include archived threads" })),
    }),
    async execute(_id, params) {
      const tapeService = getTapeService();
      if (!tapeService) return unavailableResult() as never;
      const { query, includeArchived } = params as { query?: string; includeArchived?: boolean };
      const results = tapeService.getThreadStore().search(query?.trim(), includeArchived);
      return { content: [{ type: "text", text: formatSearchResults(results) }], details: { results } };
    },
    renderCall(args, theme) {
      return renderText(
        theme.fg("toolTitle", theme.bold("tape_thread_search ")) + theme.fg("accent", args.query ?? "recent"),
      );
    },
    renderResult(result, state: RenderState, theme: Theme) {
      if (state.isPartial) return renderText(theme.fg("warning", "Searching threads..."));
      return renderText(theme.fg("toolOutput", getResultText(result)));
    },
  });
}
