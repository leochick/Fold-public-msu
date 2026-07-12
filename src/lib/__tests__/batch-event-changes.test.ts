import { describe, expect, test } from "vitest";
import { getIncomingEventFieldChanges } from "../batch-event-changes";
import { formatMergeStamp } from "../append-stamped-line";

describe("getIncomingEventFieldChanges", () => {
  test("previews notes as stamped append on merge", () => {
    const stamp = formatMergeStamp(new Date());
    const changes = getIncomingEventFieldChanges(
      { name: "Snowfest", date: "2026-02-10", notes: "Lucas, Madi" },
      { name: "Snowfest", notes: "Prior note" }
    );
    const notes = changes.find((c) => c.label === "Notes");
    expect(notes?.before).toBe("Prior note");
    expect(notes?.after).toBe(`Prior note\n${stamp} - Lucas, Madi`);
  });
});
