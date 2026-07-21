import { describe, expect, it } from "vitest";
import { findSpouseDayConflicts } from "@/lib/grouping-spouse-day-conflicts";
import type { GroupingContainerData } from "../../drizzle/schema";

describe("findSpouseDayConflicts", () => {
  const staff = [
    { id: 1, spouseId: 2 },
    { id: 2, spouseId: 1 },
    { id: 3, spouseId: null },
  ];

  it("flags spouses on different days", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Wednesday", items: [{ entity: "staff", id: 1 }] },
      { title: "B", time: "Tuesday", items: [{ entity: "staff", id: 2 }] },
    ];

    const result = findSpouseDayConflicts(containers, staff);
    expect([...result.staffIds].sort()).toEqual([1, 2]);
    expect([...result.containerIndexes].sort()).toEqual([0, 1]);
  });

  it("does not flag spouses on the same day", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Monday", items: [{ entity: "staff", id: 1 }] },
      { title: "B", time: "Monday", items: [{ entity: "staff", id: 2 }] },
    ];

    const result = findSpouseDayConflicts(containers, staff);
    expect(result.staffIds.size).toBe(0);
    expect(result.containerIndexes.size).toBe(0);
  });

  it("does not flag spouses in the same container", () => {
    const containers: GroupingContainerData[] = [
      {
        title: "A",
        time: "Monday",
        items: [
          { entity: "staff", id: 1 },
          { entity: "staff", id: 2 },
        ],
      },
    ];

    const result = findSpouseDayConflicts(containers, staff);
    expect(result.staffIds.size).toBe(0);
  });

  it("ignores containers without a day", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Monday", items: [{ entity: "staff", id: 1 }] },
      { title: "B", items: [{ entity: "staff", id: 2 }] },
    ];

    const result = findSpouseDayConflicts(containers, staff);
    expect(result.staffIds.size).toBe(0);
  });

  it("resolves one-sided spouse links", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Friday", items: [{ entity: "staff", id: 10 }] },
      { title: "B", time: "Saturday", items: [{ entity: "staff", id: 11 }] },
    ];

    const result = findSpouseDayConflicts(containers, [
      { id: 10, spouseId: 11 },
      { id: 11, spouseId: null },
    ]);
    expect([...result.staffIds].sort()).toEqual([10, 11]);
  });
});
