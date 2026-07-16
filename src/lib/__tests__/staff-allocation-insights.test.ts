import { describe, expect, it } from "vitest";
import { buildStaffAllocationInsightPayload } from "@/lib/staff-allocation-insights";
import type { StaffAllocationItem } from "@/server/staff-allocation";

describe("buildStaffAllocationInsightPayload", () => {
  const staff: StaffAllocationItem[] = [
    {
      id: 1,
      firstName: "Sam",
      lastName: "Leader",
      gender: "M",
      roles: [
        { roleName: "Small Group Lead", color: "#e5e7eb", responsibilities: [] },
        { roleName: "Welcome", color: "#93c5fd", responsibilities: [] },
      ],
      groupings: [
        {
          groupingId: 10,
          groupingName: "Fall Groups",
          containerTitle: "A",
          containerIndex: 0,
          students: [
            { id: 101, firstName: "Jane", lastName: "Doe", statuses: ["engaged"] },
            { id: 102, firstName: "Alex", lastName: "Kim", statuses: ["outreach"] },
          ],
        },
        {
          groupingId: 11,
          groupingName: "Bible Study",
          containerTitle: "Table 1",
          containerIndex: 0,
          students: [{ id: 101, firstName: "Jane", lastName: "Doe", statuses: ["engaged"] }],
        },
      ],
    },
    {
      id: 2,
      firstName: "Pat",
      lastName: "Helper",
      gender: "F",
      roles: [],
      groupings: [],
    },
  ];

  it("computes unique students and averages among assigned staff only", () => {
    const payload = buildStaffAllocationInsightPayload({
      viewName: "Fall 2025",
      viewFrom: "2025-08-01",
      viewTo: "2025-12-15",
      staff,
    });

    expect(payload.staffTotal).toBe(2);
    expect(payload.assignedStaff).toBe(1);
    expect(payload.unassignedStaff).toBe(1);
    expect(payload.averages).toEqual({
      rolesAmongAssigned: 2,
      uniqueStudentsAmongAssigned: 2,
      groupingPlacementsAmongAssigned: 2,
    });
    expect(payload.staff[0]).toMatchObject({
      name: "Sam Leader",
      assigned: true,
      roleCount: 2,
      uniqueStudentCount: 2,
      groupingPlacementCount: 2,
    });
    expect(payload.staff[1].assigned).toBe(false);
  });
});
