import { describe, expect, test } from "vitest";
import { findPossibleEventMatches, assignEventMatches, eventDateStr } from "../event-dedup";
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
    makeEvent({ id: 4, name: "D-Group", type: "Study Group", startDate: new Date(2026, 1, 1) }),
    makeEvent({ id: 5, name: "D-Group", type: "Study Group", startDate: new Date(2026, 2, 1) }),
    makeEvent({ id: 6, name: "D-Group", type: "Study Group", startDate: new Date(2026, 3, 1) }),
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

  test("matches by name across dates when date omitted", () => {
    const matches = findPossibleEventMatches({ name: "D-Group" }, existing);
    expect(matches.map((m) => m.id)).toEqual([4, 5, 6]);
  });

  test("eventDateStr formats consistently", () => {
    expect(eventDateStr({ startDate: new Date(2026, 0, 24) })).toBe("2026-01-24");
  });
});

describe("assignEventMatches", () => {
  const existing = [
    makeEvent({ id: 4, name: "D-Group", startDate: new Date(2026, 1, 1) }),
    makeEvent({ id: 5, name: "D-Group", startDate: new Date(2026, 2, 1) }),
    makeEvent({ id: 6, name: "D-Group", startDate: new Date(2026, 3, 1) }),
    makeEvent({ id: 7, name: "Snowfest", startDate: new Date(2026, 1, 10) }),
  ];

  test("assigns repeated titles to distinct events in chronological order", () => {
    const items = assignEventMatches(
      [
        { name: "D-Group", notes: "first" },
        { name: "D-Group", notes: "second" },
        { name: "Snowfest", notes: "snow" },
        { name: "D-Group", notes: "third" },
      ],
      existing,
      "update"
    );

    expect(items.map((i) => i.selectedExistingId)).toEqual([4, 5, 7, 6]);
    expect(items.every((i) => i.chosenAction === "merge")).toBe(true);
    expect(items[0].incoming.date).toBe("2026-02-01");
  });

  test("unmatched update defaults to skip", () => {
    const items = assignEventMatches([{ name: "Unknown Event", notes: "x" }], existing, "update");
    expect(items[0].chosenAction).toBe("skip");
    expect(items[0].isDuplicate).toBe(false);
  });
});
