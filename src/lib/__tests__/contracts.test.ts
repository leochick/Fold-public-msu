import { describe, test, expect } from "vitest";
import { parseAttendanceBody, commitAttendanceBody } from "../contracts/attendance";
import { parseEventBatchBody, commitEventBatchBody } from "../contracts/events";

describe("parseAttendanceBody", () => {
  test("accepts valid input", () => {
    const out = parseAttendanceBody.safeParse({ eventId: 1, text: "alex, jordan" });
    expect(out.success).toBe(true);
  });

  test("rejects missing fields", () => {
    expect(parseAttendanceBody.safeParse({}).success).toBe(false);
    expect(parseAttendanceBody.safeParse({ eventId: 1 }).success).toBe(false);
    expect(parseAttendanceBody.safeParse({ text: "x" }).success).toBe(false);
  });

  test("rejects non-positive eventId", () => {
    expect(parseAttendanceBody.safeParse({ eventId: 0, text: "x" }).success).toBe(false);
    expect(parseAttendanceBody.safeParse({ eventId: -1, text: "x" }).success).toBe(false);
  });
});

describe("commitAttendanceBody", () => {
  test("attendees defaults to empty array", () => {
    const out = commitAttendanceBody.safeParse({ eventId: 1 });
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.attendees).toEqual([]);
  });
});

describe("parseEventBatchBody", () => {
  test("non-empty text required", () => {
    expect(parseEventBatchBody.safeParse({ text: "" }).success).toBe(false);
    expect(parseEventBatchBody.safeParse({ text: "create weekly 5/1" }).success).toBe(true);
  });
});

describe("commitEventBatchBody discriminated union", () => {
  test("accepts single mode", () => {
    const out = commitEventBatchBody.safeParse({
      mode: "single",
      event: { name: "Weekly", date: "2026-05-22" },
    });
    expect(out.success).toBe(true);
  });

  test("rejects bad date format", () => {
    const out = commitEventBatchBody.safeParse({
      mode: "single",
      event: { name: "Weekly", date: "May 22" },
    });
    expect(out.success).toBe(false);
  });

  test("batch mode needs at least one item", () => {
    expect(commitEventBatchBody.safeParse({ mode: "batch", items: [] }).success).toBe(false);
    expect(
      commitEventBatchBody.safeParse({
        mode: "batch",
        items: [{ action: "create", incoming: { name: "X", date: "2026-05-22" } }],
      }).success
    ).toBe(true);
  });

  test("batch merge allows notes without date", () => {
    const out = commitEventBatchBody.safeParse({
      mode: "batch",
      items: [
        {
          action: "merge",
          existingId: 1,
          incoming: { name: "D-Group", notes: "Psalm 1" },
        },
      ],
    });
    expect(out.success).toBe(true);
  });
});
