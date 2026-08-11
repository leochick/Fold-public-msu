import { describe, expect, it } from "vitest";
import {
  buildCampusExportRows,
  formatBecameChristian,
  formatEngagementLabels,
  inferGraduatingYear,
  mapEventTypeToEngagementLabel,
  matchCampusExportColumn,
  parseCampusImportTemplate,
  buildCampusExportWorkbook,
  type CampusExportAttendance,
  type CampusExportSemester,
  type CampusExportStudent,
} from "@/lib/students-campus-export";

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default;
}

async function makeTemplateBuffer(): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const readme = workbook.addWorksheet("README");
  readme.getCell(1, 1).value = "Instructions";
  const template = workbook.addWorksheet("Template CampusName");
  const headers = [
    "Name",
    "Gender",
    "Graduating Year",
    "Faith Status",
    "Playbook",
    "Became Christian",
    "Engagement",
    "Student Lead",
    "C101 Status",
    "Baptized",
    "Baptized Date",
    "Applied to CPI?",
    "Testimony Completed",
    "Plans to Stay in A2N",
  ];
  headers.forEach((header, index) => {
    template.getCell(1, index + 1).value = header;
  });
  const other = workbook.addWorksheet("Purdue");
  other.getCell(1, 1).value = "Name";
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const semester: CampusExportSemester = {
  id: 1,
  name: "2026 Spring Semester",
  from: "2026-01-12",
  to: "2026-05-08",
};

const students: CampusExportStudent[] = [
  {
    id: 1,
    firstName: "Ada",
    lastName: "Lovelace",
    gender: "F",
    year: "junior",
    newsletter: false,
    courseMaterial: ["Course 101", "Student Leader"],
    salvationDecisionAt: "2025-09-15",
    ledToChristByStudentId: null,
    ledToChristByStaffId: 2,
  },
  {
    id: 2,
    firstName: "Ben",
    lastName: "Bitdiddle",
    gender: "M",
    year: "freshman",
    newsletter: true,
    courseMaterial: [],
    salvationDecisionAt: null,
    ledToChristByStudentId: null,
    ledToChristByStaffId: null,
  },
];

const attendances: CampusExportAttendance[] = [
  { studentId: 1, eventType: "Weekly", eventDate: "2026-02-01" },
  { studentId: 1, eventType: "Midweek Bible Study", eventDate: "2026-02-03" },
  { studentId: 1, eventType: "Weekly", eventDate: "2026-02-08" },
  { studentId: 2, eventType: "Tabling", eventDate: "2026-02-02" },
];

describe("students-campus-export helpers", () => {
  it("matches template headers", () => {
    expect(matchCampusExportColumn("Graduating Year")).toBe("Graduating Year");
    expect(matchCampusExportColumn("  student lead ")).toBe("Student Lead");
    expect(matchCampusExportColumn("Unknown")).toBeNull();
  });

  it("maps event types to engagement labels", () => {
    expect(mapEventTypeToEngagementLabel("Weekly")).toBe("SWS");
    expect(mapEventTypeToEngagementLabel("Midweek Bible Study")).toBe("Midweek Bible Study");
    expect(formatEngagementLabels(["Weekly", "Weekly", "Midweek Bible Study"])).toBe(
      "SWS, Midweek Bible Study"
    );
  });

  it("infers graduating year and became-christian labels", () => {
    expect(inferGraduatingYear("junior", 2026)).toBe(2027);
    expect(inferGraduatingYear("freshman", 2026)).toBe(2029);
    expect(inferGraduatingYear("grad", 2026)).toBe("");
    expect(formatBecameChristian("2025-09-15")).toBe("Fall 2025");
    expect(formatBecameChristian("2026-03-01")).toBe("Spring 2026");
  });
});

describe("buildCampusExportRows", () => {
  it("filters by status and fills template fields", () => {
    const rows = buildCampusExportRows({
      students,
      attendances,
      semesters: [semester],
      statuses: ["student_leader", "outreach"],
    });

    expect(rows.map((row) => row.studentId)).toEqual([1, 2]);

    const ada = rows.find((row) => row.studentId === 1)!;
    expect(ada.status).toBe("student_leader");
    expect(ada.values.Name).toBe("Ada Lovelace");
    expect(ada.values.Gender).toBe("Female");
    expect(ada.values["Graduating Year"]).toBe(2027);
    expect(ada.values["Faith Status"]).toBe("Christian");
    expect(ada.values.Playbook).toBe("Unknown");
    expect(ada.values["Became Christian"]).toBe("Fall 2025");
    expect(ada.values.Engagement).toBe("SWS, Midweek Bible Study");
    expect(ada.values["Student Lead"]).toBe(true);
    expect(ada.values["C101 Status"]).toBe("Completed");

    const ben = rows.find((row) => row.studentId === 2)!;
    expect(ben.status).toBe("outreach");
    expect(ben.values["Faith Status"]).toBe("Unknown");
    expect(ben.values["C101 Status"]).toBe("Not started");
  });

  it("returns empty when no statuses selected", () => {
    expect(
      buildCampusExportRows({
        students,
        attendances,
        semesters: [semester],
        statuses: [],
      })
    ).toEqual([]);
  });
});

describe("parse and fill campus import template", () => {
  it("parses the template sheet and writes export rows", async () => {
    const buffer = await makeTemplateBuffer();
    const parsed = await parseCampusImportTemplate(buffer, "template.xlsx");
    expect(parsed.templateSheetName).toBe("Template CampusName");
    expect(parsed.matchedColumns).toContain("Name");

    const rows = buildCampusExportRows({
      students,
      attendances,
      semesters: [semester],
      statuses: ["student_leader"],
    });

    const workbook = await buildCampusExportWorkbook({
      templateData: buffer,
      templateSheetName: parsed.templateSheetName,
      headers: parsed.headers,
      rows,
      campusSheetName: "MSU",
    });

    expect(workbook.worksheets.map((sheet) => sheet.name).sort()).toEqual(["MSU", "README"]);
    const sheet = workbook.getWorksheet("MSU")!;
    expect(sheet.getCell(2, 1).value).toBe("Ada Lovelace");
    expect(sheet.getCell(2, 2).value).toBe("Female");
    expect(sheet.getCell(2, 8).value).toBe(true);
  });
});
