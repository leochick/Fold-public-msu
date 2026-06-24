import { describe, expect, test } from "vitest";
import { findPossibleEventMatches, eventDateStr } from "../event-dedup";
import type { Event } from "../../../../drizzle/schema";

function makeEvent(partial: Partial<Event> & { id: number; name: string; startDate: Date }): Event {
  return {
    id: partial.id,
    name: partial.name,
    type: partial.type ?? null,
    startDate: partial.startDate,
    endDate: partial.endDate ?? null,
    location: partial.location ?? null,
    notes: partial.notes ?? null,
    totalStudents: partial.totalStudents ?? null,
    createdAt: partial.createdAt ?? new Date(),
  };
}

describe("findPossibleEventMatches", () => {
  const existing = [
    makeEvent({ id: 1, name: "Large Group", type: "General", startDate: new Date(2026, 0, 24) }),
    makeEvent({ id: 2, name: "Weekly Meeting", type: "Weekly", startDate: new Date(2026, 4, 1) }),
    makeEvent({ id: 3, name: "Weekly", type: "Weekly", startDate: new Date(2026, 4, 1) }),
  ];

  test("matches by exact name and date", () => {
    const matches = findPossibleEventMatches(
      { name: "Large Group", date: "2026-01-24" },
      existing
    );
    expect(matches.map((m) => m.id)).toEqual([1]);
  });

  test("matches fuzzy name on same date", () => {
    const matches = findPossibleEventMatches(
      { name: "Weekly", date: "2026-05-01" },
      existing
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.id === 2 || m.id === 3)).toBe(true);
  });

  test("returns empty when no event on date", () => {
    const matches = findPossibleEventMatches(
      { name: "Large Group", date: "2026-03-16" },
      existing
    );
    expect(matches).toEqual([]);
  });

  test("eventDateStr formats consistently", () => {
    expect(eventDateStr({ startDate: new Date(2026, 0, 24) })).toBe("2026-01-24");
  });
});
