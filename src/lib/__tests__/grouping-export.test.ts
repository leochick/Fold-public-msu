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
        position: 1,
        type: "Student",
        firstName: "Jane",
        lastName: "Doe",
        gender: "F",
        year: "sophomore",
        status: "Engaged",
        courseMaterial: "Course 101",
        newsletter: "Yes",
        groupme: "No",
        attendance: 4,
      },
      {
        group: "Group A",
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
      },
    ]);
  });

  it("builds a multi-sheet workbook buffer", async () => {
    const workbook = await buildGroupingWorkbook(snapshot);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Members",
      "By Group",
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(groupingExportFilename("Fall Small Groups")).toMatch(
      /^Fall-Small-Groups-\d{4}-\d{2}-\d{2}\.xlsx$/
    );
  });
});
