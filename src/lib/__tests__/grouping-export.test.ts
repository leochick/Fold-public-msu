import { describe, expect, it } from "vitest";
import {
  buildGroupingMemberRows,
  buildGroupingWorkbook,
  groupingExportFilename,
  type GroupingExportSnapshot,
} from "@/lib/grouping-export";

describe("buildGroupingMemberRows", () => {
  const snapshot: GroupingExportSnapshot = {
    groupingName: "Fall Small Groups",
    viewName: "Fall 2025",
    viewFrom: "2025-08-01",
    viewTo: "2025-12-15",
    eventSelectionLabel: "All events",
    eventNames: ["Kickoff", "Retreat"],
    groups: [
      {
        title: "Group A",
        day: "Wednesday",
        location: "Student Center",
        hasSpouseDayConflict: true,
        members: [
          {
            entity: "student",
            firstName: "Jane",
            lastName: "Doe",
            gender: "F",
            year: "sophomore",
            statuses: ["engaged"],
            courseMaterial: ["Course 101"],
            newsletter: true,
            groupme: false,
            attendanceCountInRange: 4,
          },
          {
            entity: "staff",
            firstName: "Sam",
            lastName: "Leader",
            gender: "M",
            year: null,
            statuses: [],
            courseMaterial: null,
            newsletter: null,
            groupme: null,
            attendanceCountInRange: null,
            hasSpouseDayConflict: true,
          },
        ],
      },
      {
        title: "",
        members: [],
      },
    ],
  };

  it("flattens members with group titles and student-only fields", () => {
    const rows = buildGroupingMemberRows(snapshot);
    expect(rows).toEqual([
      {
        group: "Group A",
        day: "Wednesday",
        location: "Student Center",
        position: 1,
        type: "Student",
        firstName: "Jane",
        lastName: "Doe",
        gender: "F",
        year: "sophomore",
        status: "Engaged (3+ events)",
        courseMaterial: "Course 101",
        newsletter: "Yes",
        groupme: "No",
        attendance: 4,
        spouseDayConflict: "",
      },
      {
        group: "Group A",
        day: "Wednesday",
        location: "Student Center",
        position: 2,
        type: "Staff",
        firstName: "Sam",
        lastName: "Leader",
        gender: "M",
        year: "",
        status: "",
        courseMaterial: "",
        newsletter: "",
        groupme: "",
        attendance: "",
        spouseDayConflict: "Yes",
      },
    ]);
  });

  it("builds a multi-sheet workbook buffer with new columns", async () => {
    const workbook = await buildGroupingWorkbook(snapshot);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Members",
      "By Group",
    ]);

    const members = workbook.getWorksheet("Members");
    expect(members?.getRow(1).getCell(1).value).toBe("Group");
    expect(members?.getRow(1).getCell(2).value).toBe("Day");
    expect(members?.getRow(1).getCell(3).value).toBe("Location");
    expect(members?.getRow(1).getCell(15).value).toBe("Spouse Day Conflict");
    expect(members?.getRow(2).getCell(2).value).toBe("Wednesday");
    expect(members?.getRow(2).getCell(3).value).toBe("Student Center");
    expect(members?.getRow(3).getCell(15).value).toBe("Yes");

    const summary = workbook.getWorksheet("Summary");
    expect(summary?.getRow(8).getCell(1).value).toBe("Spouse day conflicts");
    expect(summary?.getRow(8).getCell(2).value).toBe(1);

    const byGroup = workbook.getWorksheet("By Group");
    expect(String(byGroup?.getRow(1).getCell(1).value)).toContain("Wednesday");
    expect(String(byGroup?.getRow(1).getCell(1).value)).toContain("Student Center");
    expect(String(byGroup?.getRow(1).getCell(1).value)).toContain("Spouse day conflict");

    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(groupingExportFilename("Fall Small Groups")).toMatch(
      /^Fall-Small-Groups-\d{4}-\d{2}-\d{2}\.xlsx$/
    );
  });
});
