import { describe, expect, it } from "vitest";
import {
  buildStaffAllocationWorkbook,
  buildStaffGroupingRows,
  buildStaffOverviewRows,
  buildStaffRoleRows,
  staffAllocationExportFilename,
  type StaffAllocationExportSnapshot,
} from "@/lib/staff-allocation-export";

describe("staff allocation export", () => {
  const snapshot: StaffAllocationExportSnapshot = {
    viewName: "Fall 2025",
    viewFrom: "2025-08-01",
    viewTo: "2025-12-15",
    staff: [
      {
        id: 1,
        firstName: "Sam",
        lastName: "Leader",
        gender: "M",
        roles: [
          { roleName: "Small Group Lead", color: "#e5e7eb" },
          { roleName: "Welcome Team", color: "#bfdbfe" },
        ],
        groupings: [
          {
            groupingId: 10,
            groupingName: "Fall Small Groups",
            containerTitle: "Group A",
            containerIndex: 0,
            students: [
              { id: 101, firstName: "Jane", lastName: "Doe", statuses: ["engaged"] },
              { id: 102, firstName: "Alex", lastName: "Kim", statuses: ["active"] },
            ],
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
    ],
  };

  it("builds overview, role, and grouping rows", () => {
    expect(buildStaffOverviewRows(snapshot)).toEqual([
      {
        staff: "Sam Leader",
        firstName: "Sam",
        lastName: "Leader",
        gender: "M",
        assigned: "Yes",
        roles: "Small Group Lead, Welcome Team",
        roleCount: 2,
        groupingPlacements: 1,
        studentsAcrossGroupings: 2,
      },
      {
        staff: "Pat Helper",
        firstName: "Pat",
        lastName: "Helper",
        gender: "F",
        assigned: "No",
        roles: "",
        roleCount: 0,
        groupingPlacements: 0,
        studentsAcrossGroupings: 0,
      },
    ]);

    expect(buildStaffRoleRows(snapshot)).toEqual([
      { staff: "Sam Leader", role: "Small Group Lead" },
      { staff: "Sam Leader", role: "Welcome Team" },
    ]);

    expect(buildStaffGroupingRows(snapshot)).toEqual([
      {
        staff: "Sam Leader",
        grouping: "Fall Small Groups",
        container: "Group A",
        studentCount: 2,
        students: "Jane Doe, Alex Kim",
      },
    ]);
  });

  it("builds a multi-sheet workbook buffer", async () => {
    const workbook = await buildStaffAllocationWorkbook(snapshot);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Staff",
      "Roles",
      "Groupings",
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(staffAllocationExportFilename("Fall 2025")).toMatch(
      /^Staff-Allocation-Fall-2025-\d{4}-\d{2}-\d{2}\.xlsx$/
    );
  });
});
