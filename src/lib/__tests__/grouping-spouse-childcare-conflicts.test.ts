import { describe, expect, it } from "vitest";
import { findSpouseChildcareConflicts } from "@/lib/grouping-spouse-childcare-conflicts";
import type { GroupingContainerData } from "../../drizzle/schema";

describe("findSpouseChildcareConflicts", () => {
  const staff = [
    { id: 1, spouseId: 2, hasChildren: true },
    { id: 2, spouseId: 1, hasChildren: false },
    { id: 3, spouseId: null, hasChildren: true },
  ];

  it("flags spouses on the same day when either has children", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Monday", items: [{ entity: "staff", id: 1 }] },
      { title: "B", time: "Monday", items: [{ entity: "staff", id: 2 }] },
    ];

    const result = findSpouseChildcareConflicts(containers, staff);
    expect([...result.staffIds].sort()).toEqual([1, 2]);
    expect([...result.containerIndexes].sort()).toEqual([0, 1]);
  });

  it("flags spouses in the same container on a day when they have children", () => {
    const containers: GroupingContainerData[] = [
      {
        title: "A",
        time: "Wednesday",
        items: [
          { entity: "staff", id: 1 },
          { entity: "staff", id: 2 },
        ],
      },
    ];

    const result = findSpouseChildcareConflicts(containers, staff);
    expect([...result.staffIds].sort()).toEqual([1, 2]);
    expect([...result.containerIndexes]).toEqual([0]);
  });

  it("does not flag spouses on different days", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Monday", items: [{ entity: "staff", id: 1 }] },
      { title: "B", time: "Tuesday", items: [{ entity: "staff", id: 2 }] },
    ];

    const result = findSpouseChildcareConflicts(containers, staff);
    expect(result.staffIds.size).toBe(0);
  });

  it("does not flag spouses on the same day when neither has children", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Monday", items: [{ entity: "staff", id: 10 }] },
      { title: "B", time: "Monday", items: [{ entity: "staff", id: 11 }] },
    ];

    const result = findSpouseChildcareConflicts(containers, [
      { id: 10, spouseId: 11, hasChildren: false },
      { id: 11, spouseId: 10, hasChildren: false },
    ]);
    expect(result.staffIds.size).toBe(0);
  });

  it("ignores containers without a day", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Monday", items: [{ entity: "staff", id: 1 }] },
      { title: "B", items: [{ entity: "staff", id: 2 }] },
    ];

    const result = findSpouseChildcareConflicts(containers, staff);
    expect(result.staffIds.size).toBe(0);
  });

  it("resolves one-sided spouse links", () => {
    const containers: GroupingContainerData[] = [
      { title: "A", time: "Friday", items: [{ entity: "staff", id: 10 }] },
      { title: "B", time: "Friday", items: [{ entity: "staff", id: 11 }] },
    ];

    const result = findSpouseChildcareConflicts(containers, [
      { id: 10, spouseId: 11, hasChildren: true },
      { id: 11, spouseId: null, hasChildren: false },
    ]);
    expect([...result.staffIds].sort()).toEqual([10, 11]);
  });
});
