import { describe, test, expect } from "vitest";
import { parseAttendanceBody, commitAttendanceBody } from "../contracts/attendance";
import { parseEventBatchBody, commitEventBatchBody } from "../contracts/events";
import { askBody, nlQueryBody } from "../contracts/query";
import { draftOutreachBody, funnelStageBody } from "../contracts/students";

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
});

describe("query bodies", () => {
  test("askBody requires text", () => {
    expect(askBody.safeParse({}).success).toBe(false);
    expect(askBody.safeParse({ text: "all juniors" }).success).toBe(true);
  });
  test("nlQueryBody requires query", () => {
    expect(nlQueryBody.safeParse({ query: "core members" }).success).toBe(true);
    expect(nlQueryBody.safeParse({}).success).toBe(false);
  });
});

describe("students bodies", () => {
  test("draftOutreachBody defaults channel to ig_dm", () => {
    const out = draftOutreachBody.safeParse({});
    expect(out.success).toBe(true);
    if (out.success) expect(out.data.channel).toBe("ig_dm");
  });
  test("draftOutreachBody rejects invalid channel", () => {
    expect(draftOutreachBody.safeParse({ channel: "carrierpigeon" }).success).toBe(false);
  });
  test("funnelStageBody requires valid stage", () => {
    expect(funnelStageBody.safeParse({ stage: "engaged" }).success).toBe(true);
    expect(funnelStageBody.safeParse({ stage: "made_up" }).success).toBe(false);
  });
});
