import assert from "node:assert/strict";
import { test } from "node:test";
import type { TapeAnchor } from "../tape/tape-anchor.js";
import { isTimelineReviewAnchor } from "../tape/tape-review.js";

function createAnchor(type: TapeAnchor["type"]): TapeAnchor {
  return {
    id: `${type}-1`,
    name: `${type}/demo`,
    type,
    sessionId: "session-1",
    sessionEntryId: "entry-1",
    timestamp: "2026-04-23T10:00:00.000Z",
  };
}

test("memory review timeline hides thread anchors", () => {
  assert.equal(isTimelineReviewAnchor(createAnchor("thread")), false);
  assert.equal(isTimelineReviewAnchor(createAnchor("handoff")), true);
});
