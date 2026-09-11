import { describe, expect, it } from "vitest";
import {
  PREVIOUS_SEMESTER_FALLBACK,
  buildEventFunnelPayload,
  buildSourcesForEvent,
  pickFirstEvents,
  semesterNameForDate,
  sourceLabel,
} from "../event-funnel";

const FALL_2025 = { name: "2025 Fall Semester", fromMs: Date.UTC(2025, 7, 20), toMs: Date.UTC(2025, 11, 12, 23, 59, 59, 999) };
const SPRING_2026 = { name: "2026 Spring Semester", fromMs: Date.UTC(2026, 0, 12), toMs: Date.UTC(2026, 4, 8, 23, 59, 59, 999) };
const FALL_2026 = { name: "2026 Fall Semester", fromMs: Date.UTC(2026, 7, 25), toMs: Date.UTC(2026, 11, 11, 23, 59, 59, 999) };
const SEMESTERS = [FALL_2025, SPRING_2026, FALL_2026];

describe("pickFirstEvents", () => {
  it("keeps the earliest event and uses event id as a same-day tiebreak", () => {
    const first = pickFirstEvents([
      { studentId: 1, eventId: 20, name: "Later", startMs: Date.UTC(2026, 8, 10) },
      { studentId: 1, eventId: 8, name: "Same day B", startMs: Date.UTC(2026, 8, 1) },
      { studentId: 1, eventId: 3, name: "Same day A", startMs: Date.UTC(2026, 8, 1) },
    ]);
    expect(first.get(1)).toMatchObject({ eventId: 3, name: "Same day A" });
  });
});

describe("semesterNameForDate / sourceLabel", () => {
  it("matches a date to the containing semester", () => {
    expect(semesterNameForDate(Date.UTC(2025, 9, 1), SEMESTERS)).toBe("2025 Fall Semester");
    expect(semesterNameForDate(Date.UTC(2020, 0, 1), SEMESTERS)).toBeNull();
  });

  it("adds the previous semester in parentheses for returning students", () => {
    expect(
      sourceLabel({ eventName: "Fall Retreat", returning: true, semesterName: "2025 Fall Semester" })
    ).toBe("Fall Retreat (2025 Fall Semester)");
    expect(sourceLabel({ eventName: "Mystery", returning: true, semesterName: null })).toBe(
      `Mystery (${PREVIOUS_SEMESTER_FALLBACK})`
    );
    expect(sourceLabel({ eventName: "Tabling", returning: false, semesterName: null })).toBe("Tabling");
  });
});

describe("buildSourcesForEvent", () => {
  it("aggregates first events and marks previous-semester sources as returning", () => {
    const firstByStudent = pickFirstEvents([
      { studentId: 1, eventId: 10, name: "Sparticipation", startMs: Date.UTC(2026, 7, 30) },
      { studentId: 2, eventId: 10, name: "Sparticipation", startMs: Date.UTC(2026, 7, 30) },
      { studentId: 3, eventId: 11, name: "Open House", startMs: Date.UTC(2026, 7, 31) },
      { studentId: 4, eventId: 2, name: "Fall Retreat", startMs: Date.UTC(2025, 9, 4) },
      { studentId: 5, eventId: 3, name: "Large Group", startMs: Date.UTC(2026, 1, 15) },
      { studentId: 6, eventId: 99, name: "Unknown Past", startMs: Date.UTC(2024, 2, 1) },
    ]);

    const sources = buildSourcesForEvent(
      [1, 2, 3, 4, 5, 6],
      firstByStudent,
      FALL_2026,
      SEMESTERS
    );

    expect(sources.map((s) => ({ label: s.label, count: s.count, returning: s.returning }))).toEqual([
      { label: "Sparticipation", count: 2, returning: false },
      { label: "Open House", count: 1, returning: false },
      { label: "Unknown Past (previous semester)", count: 1, returning: true },
      { label: "Fall Retreat (2025 Fall Semester)", count: 1, returning: true },
      { label: "Large Group (2026 Spring Semester)", count: 1, returning: true },
    ]);
  });
});

describe("buildEventFunnelPayload", () => {
  it("builds a selectable breakdown per current-semester event", () => {
    const payload = buildEventFunnelPayload({
      events: [
        { id: 20, name: "Anchor Large Group", startMs: Date.UTC(2026, 8, 3) },
        { id: 10, name: "Sparticipation", startMs: Date.UTC(2026, 7, 30) },
      ],
      attendances: [
        { studentId: 1, eventId: 10 },
        { studentId: 1, eventId: 20 },
        { studentId: 2, eventId: 20 },
        { studentId: 3, eventId: 20 },
      ],
      firstEvents: [
        { studentId: 1, eventId: 10, name: "Sparticipation", startMs: Date.UTC(2026, 7, 30) },
        { studentId: 2, eventId: 20, name: "Anchor Large Group", startMs: Date.UTC(2026, 8, 3) },
        { studentId: 3, eventId: 2, name: "Fall Retreat", startMs: Date.UTC(2025, 9, 4) },
      ],
      current: FALL_2026,
      semesters: SEMESTERS,
      dateLabel: (startMs) => new Date(startMs).toISOString().slice(0, 10),
    });

    expect(payload.events.map((e) => e.id)).toEqual([10, 20]);
    expect(payload.byEventId["10"].total).toBe(1);

    const withDupes = buildEventFunnelPayload({
      events: [{ id: 20, name: "Anchor Large Group", startMs: Date.UTC(2026, 8, 3) }],
      attendances: [
        { studentId: 1, eventId: 20 },
        { studentId: 1, eventId: 20 },
      ],
      firstEvents: [
        { studentId: 1, eventId: 20, name: "Anchor Large Group", startMs: Date.UTC(2026, 8, 3) },
      ],
      current: FALL_2026,
      semesters: SEMESTERS,
      dateLabel: () => "Sep 3",
    });
    expect(withDupes.byEventId["20"]).toMatchObject({
      total: 1,
      sources: [{ label: "Anchor Large Group", count: 1 }],
    });
    expect(payload.byEventId["20"]).toEqual({
      total: 3,
      sources: [
        {
          key: "c:10",
          eventId: 10,
          label: "Sparticipation",
          count: 1,
          returning: false,
          startMs: Date.UTC(2026, 7, 30),
        },
        {
          key: "c:20",
          eventId: 20,
          label: "Anchor Large Group",
          count: 1,
          returning: false,
          startMs: Date.UTC(2026, 8, 3),
        },
        {
          key: "r:2",
          eventId: 2,
          label: "Fall Retreat (2025 Fall Semester)",
          count: 1,
          returning: true,
          startMs: Date.UTC(2025, 9, 4),
        },
      ],
    });
  });
});
