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
});
