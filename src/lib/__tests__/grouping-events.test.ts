import { describe, expect, it } from "vitest";
import { formatGroupingEventSelection } from "@/lib/grouping-events";

describe("formatGroupingEventSelection", () => {
  const names = new Map([
    [1, "Spring Retreat"],
    [2, "Weekly Meeting"],
  ]);

  it("returns All events when null", () => {
    expect(formatGroupingEventSelection(null, names)).toBe("All events");
  });

  it("returns Various events for multiple selections", () => {
    expect(formatGroupingEventSelection([1, 2], names)).toBe("Various events");
  });

  it("returns the event name for a single selection", () => {
    expect(formatGroupingEventSelection([1], names)).toBe("Spring Retreat");
  });
});
