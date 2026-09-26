import { describe, expect, it } from "vitest";
import {
  dropInsertToIndex,
  remapIndexAfterReorder,
  reorderList,
  shouldShowContainerInsertGap,
} from "@/lib/container-board";
import {
  genderGroups,
  groupEventsByType,
  insertEvent,
  regularsForEvents,
  removeEvent,
  type RegularsEvent,
  type RegularsStudent,
} from "@/lib/regulars";

const students: RegularsStudent[] = [
  { id: 1, firstName: "Alex", lastName: "Kim", gender: "M" },
  { id: 2, firstName: "Jordan", lastName: "Lee", gender: "F" },
  { id: 3, firstName: "Sam", lastName: null, gender: null },
];

const events: RegularsEvent[] = [
  { id: 10, name: "Weekly B", type: "Weekly", startDate: "2026-02-08T00:00:00.000Z" },
  { id: 11, name: "Social", type: "Social", startDate: "2026-02-01T00:00:00.000Z" },
  { id: 12, name: "Weekly A", type: " Weekly ", startDate: "2026-02-01T00:00:00.000Z" },
  { id: 13, name: "Untitled night", type: null, startDate: "2026-01-15T00:00:00.000Z" },
];

describe("regularsForEvents", () => {
  const attendances = [
    { studentId: 1, eventId: 10 },
    { studentId: 1, eventId: 12 },
    { studentId: 1, eventId: 12 },
    { studentId: 2, eventId: 10 },
    { studentId: 3, eventId: 11 },
  ];

  it("counts a student once per event and applies the minimum", () => {
    const regulars = regularsForEvents([10, 12], students, attendances, 2);
    expect(regulars.map((student) => student.id)).toEqual([1]);
  });

  it("ignores attendance outside the container", () => {
    const regulars = regularsForEvents([11], students, attendances, 1);
    expect(regulars.map((student) => student.id)).toEqual([3]);
  });

  it("returns nobody for an empty container", () => {
    expect(regularsForEvents([], students, attendances, 0)).toEqual([]);
  });

  it("sorts regulars by name", () => {
    const regulars = regularsForEvents([10, 11, 12], students, attendances, 1);
    expect(regulars.map((student) => student.id)).toEqual([1, 2, 3]);
  });
});

describe("genderGroups", () => {
  it("splits regulars by gender and keeps name order", () => {
    const groups = genderGroups(students);
    expect(groups.male.map((student) => student.id)).toEqual([1]);
    expect(groups.female.map((student) => student.id)).toEqual([2]);
    expect(groups.unspecified.map((student) => student.id)).toEqual([3]);
  });
});

describe("groupEventsByType", () => {
  it("builds one container per type, with undated types last and events by date", () => {
    expect(groupEventsByType(events)).toEqual([
      { title: "Social", eventIds: [11] },
      { title: "Weekly", eventIds: [12, 10] },
      { title: "No type", eventIds: [13] },
    ]);
  });
});

describe("insertEvent", () => {
  it("moves an event between containers and reorders within one", () => {
    const containers = [
      { title: "A", eventIds: [1, 2] },
      { title: "B", eventIds: [3] },
    ];
    expect(insertEvent(containers, 1, 2, 1)).toEqual([
      { title: "A", eventIds: [1] },
      { title: "B", eventIds: [3, 2] },
    ]);
    expect(insertEvent(containers, 0, 2, 0)).toEqual([
      { title: "A", eventIds: [2, 1] },
      { title: "B", eventIds: [3] },
    ]);
  });

  it("returns an event to the unassigned pool", () => {
    expect(removeEvent([{ title: "A", eventIds: [1, 2] }], 1)).toEqual([
      { title: "A", eventIds: [2] },
    ]);
  });
});

describe("container reorder helpers", () => {
  it("maps a drop gap to the index after removal", () => {
    expect(dropInsertToIndex(0, 3)).toBe(2);
    expect(dropInsertToIndex(2, 0)).toBe(0);
    expect(shouldShowContainerInsertGap(1, 2)).toBe(false);
    expect(shouldShowContainerInsertGap(1, 3)).toBe(true);
  });

  it("reorders a list and remaps a tracked index", () => {
    expect(reorderList(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(remapIndexAfterReorder(2, 0, 2)).toBe(1);
    expect(reorderList(["a"], 0, 0)).toEqual(["a"]);
  });
});
