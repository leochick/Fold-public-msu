import { describe, expect, it } from "vitest";
import { normalizeGroupingContainers } from "@/lib/grouping-containers";

describe("normalizeGroupingContainers", () => {
  it("preserves staff associatedRoleName and strips empty values", () => {
    const containers = normalizeGroupingContainers([
      {
        title: "Group A",
        items: [
          { entity: "staff", id: 1, associatedRoleName: "  Small Group Leader  " },
          { entity: "staff", id: 2, associatedRoleName: "   " },
          { entity: "student", id: 3, associatedRoleName: "ignored" },
        ],
      },
    ]);

    expect(containers).toEqual([
      {
        title: "Group A",
        items: [
          { entity: "staff", id: 1, associatedRoleName: "Small Group Leader" },
          { entity: "staff", id: 2 },
          { entity: "student", id: 3 },
        ],
      },
    ]);
  });

  it("preserves location and time and drops blank values", () => {
    const containers = normalizeGroupingContainers([
      {
        title: "Group A",
        location: "  Student Center  ",
        time: "Monday",
        items: [{ entity: "student", id: 1 }],
      },
      {
        title: "Group B",
        location: "   ",
        time: "",
        items: [],
      },
      {
        title: "Group C",
        time: "2026-07-21T18:30",
        items: [],
      },
    ]);

    expect(containers).toEqual([
      {
        title: "Group A",
        location: "Student Center",
        time: "Monday",
        items: [{ entity: "student", id: 1 }],
      },
      {
        title: "Group B",
        items: [],
      },
      {
        title: "Group C",
        items: [],
      },
    ]);
  });
});