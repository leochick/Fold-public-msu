import { describe, expect, it } from "vitest";
import { appendStampedLine, formatMergeStamp } from "@/lib/append-stamped-line";

describe("formatMergeStamp", () => {
  it("formats as M/D/YY without leading zeros", () => {
    expect(formatMergeStamp(new Date(2026, 6, 12))).toBe("7/12/26");
    expect(formatMergeStamp(new Date(2026, 0, 5))).toBe("1/5/26");
  });
});

describe("appendStampedLine", () => {
  const stampDate = new Date(2026, 6, 12);

  it("appends a stamped line under existing text", () => {
    expect(appendStampedLine("Friends with Ariana", "Goes by Sierra", stampDate)).toBe(
      "Friends with Ariana\n7/12/26 - Goes by Sierra"
    );
  });

  it("returns only the stamped line when existing is empty", () => {
    expect(appendStampedLine(null, "Goes by Sierra", stampDate)).toBe("7/12/26 - Goes by Sierra");
    expect(appendStampedLine("  ", "Goes by Sierra", stampDate)).toBe("7/12/26 - Goes by Sierra");
  });

  it("keeps existing when incoming is empty", () => {
    expect(appendStampedLine("Friend of Jade", null, stampDate)).toBe("Friend of Jade");
    expect(appendStampedLine("Friend of Jade", "  ", stampDate)).toBe("Friend of Jade");
  });

  it("returns null when both are empty", () => {
    expect(appendStampedLine(null, null, stampDate)).toBeNull();
    expect(appendStampedLine("", "", stampDate)).toBeNull();
  });

  it("does not duplicate an identical stamped line", () => {
    const once = appendStampedLine("Friends with Ariana", "Goes by Sierra", stampDate);
    expect(appendStampedLine(once, "Goes by Sierra", stampDate)).toBe(once);
  });
});
