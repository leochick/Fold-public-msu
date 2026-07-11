import type ExcelJS from "exceljs";
import { GROUPING_STATUS_LABELS, type GroupingStudentStatus } from "@/lib/grouping-status";

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default;
}

export type GroupingExportMember = {
  entity: "student" | "staff";
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  year: string | null;
  statuses: GroupingStudentStatus[];
  courseMaterial: string[] | null;
  newsletter: boolean | null;
  groupme: boolean | null;
  attendanceCountInRange: number | null;
};

export type GroupingExportGroup = {
  title: string;
  members: GroupingExportMember[];
};

export type GroupingExportSnapshot = {
  groupingName: string;
  viewName: string;
  viewFrom: string;
  viewTo: string;
  eventSelectionLabel: string;
  eventNames: string[];
  groups: GroupingExportGroup[];
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const META_LABEL_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
};

const MEMBER_HEADERS = [
  "Group",
  "Position",
  "Type",
  "First Name",
  "Last Name",
  "Gender",
  "Year",
  "Status",
  "Course Material",
  "Newsletter",
  "GroupMe",
  "Attendance in View",
] as const;

function formatYesNo(value: boolean | null): string {
  if (value === null) return "";
  return value ? "Yes" : "No";
}

function formatStatuses(statuses: GroupingStudentStatus[]): string {
  return statuses.map((status) => GROUPING_STATUS_LABELS[status]).join(", ");
}

function formatCourseMaterial(courseMaterial: string[] | null): string {
  return courseMaterial?.length ? courseMaterial.join(", ") : "";
}

function groupDisplayTitle(title: string, index: number): string {
  const trimmed = title.trim();
  return trimmed || `Group ${index + 1}`;
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return cleaned || "grouping";
}

function applyHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF111827" } },
    };
  });
  row.height = 22;
}

function styleDataCell(cell: ExcelJS.Cell, options?: { center?: boolean }) {
  cell.alignment = {
    vertical: "middle",
    horizontal: options?.center ? "center" : "left",
    wrapText: true,
  };
  cell.border = {
    top: { style: "hair", color: { argb: "FFE5E7EB" } },
    bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
    left: { style: "hair", color: { argb: "FFE5E7EB" } },
    right: { style: "hair", color: { argb: "FFE5E7EB" } },
  };
}

export function buildGroupingMemberRows(snapshot: GroupingExportSnapshot) {
  const rows: Array<{
    group: string;
    position: number;
    type: string;
    firstName: string;
    lastName: string;
    gender: string;
    year: string;
    status: string;
    courseMaterial: string;
    newsletter: string;
    groupme: string;
    attendance: number | string;
  }> = [];

  snapshot.groups.forEach((group, groupIndex) => {
    const title = groupDisplayTitle(group.title, groupIndex);
    group.members.forEach((member, memberIndex) => {
      const isStudent = member.entity === "student";
      rows.push({
        group: title,
        position: memberIndex + 1,
        type: isStudent ? "Student" : "Staff",
        firstName: member.firstName,
        lastName: member.lastName ?? "",
        gender: member.gender ?? "",
        year: isStudent ? (member.year ?? "") : "",
        status: isStudent ? formatStatuses(member.statuses) : "",
        courseMaterial: isStudent ? formatCourseMaterial(member.courseMaterial) : "",
        newsletter: isStudent ? formatYesNo(member.newsletter) : "",
        groupme: isStudent ? formatYesNo(member.groupme) : "",
        attendance: isStudent ? (member.attendanceCountInRange ?? "") : "",
      });
    });
  });

  return rows;
}

export async function buildGroupingWorkbook(snapshot: GroupingExportSnapshot): Promise<ExcelJS.Workbook> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fold";
  workbook.created = new Date();
  workbook.modified = new Date();

  const exportedAt = new Date().toLocaleString();
  const eventDetail =
    snapshot.eventNames.length > 0
      ? snapshot.eventNames.join(", ")
      : snapshot.eventSelectionLabel;

  const studentCount = snapshot.groups.reduce(
    (count, group) => count + group.members.filter((member) => member.entity === "student").length,
    0
  );
  const staffCount = snapshot.groups.reduce(
    (count, group) => count + group.members.filter((member) => member.entity === "staff").length,
    0
  );

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  summary.columns = [
    { key: "label", width: 22 },
    { key: "value", width: 56 },
  ];

  const summaryRows: Array<[string, string | number]> = [
    ["Grouping", snapshot.groupingName],
    ["View", snapshot.viewName],
    ["Date range", `${snapshot.viewFrom} – ${snapshot.viewTo}`],
    ["Events", eventDetail],
    ["Groups", snapshot.groups.length],
    ["Students assigned", studentCount],
    ["Staff assigned", staffCount],
    ["Exported at", exportedAt],
  ];

  summaryRows.forEach(([label, value], index) => {
    const row = summary.getRow(index + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = META_LABEL_FONT;
    row.getCell(2).value = value;
    row.getCell(2).alignment = { wrapText: true, vertical: "middle" };
    row.height = 20;
  });

  const members = workbook.addWorksheet("Members");
  members.columns = [
    { key: "group", width: 18 },
    { key: "position", width: 10 },
    { key: "type", width: 10 },
    { key: "firstName", width: 16 },
    { key: "lastName", width: 16 },
    { key: "gender", width: 10 },
    { key: "year", width: 12 },
    { key: "status", width: 22 },
    { key: "courseMaterial", width: 28 },
    { key: "newsletter", width: 12 },
    { key: "groupme", width: 12 },
    { key: "attendance", width: 16 },
  ];

  const headerRow = members.getRow(1);
  MEMBER_HEADERS.forEach((header, index) => {
    headerRow.getCell(index + 1).value = header;
  });
  applyHeaderRow(headerRow);
  members.views = [{ state: "frozen", ySplit: 1 }];
  members.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: MEMBER_HEADERS.length },
  };

  const memberRows = buildGroupingMemberRows(snapshot);
  memberRows.forEach((data, index) => {
    const row = members.getRow(index + 2);
    row.values = [
      data.group,
      data.position,
      data.type,
      data.firstName,
      data.lastName,
      data.gender,
      data.year,
      data.status,
      data.courseMaterial,
      data.newsletter,
      data.groupme,
      data.attendance,
    ];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      styleDataCell(cell, {
        center: colNumber === 2 || colNumber === 3 || colNumber === 6 || colNumber === 10 || colNumber === 11,
      });
    });
  });

  const byGroup = workbook.addWorksheet("By Group");
  const groupTitles = snapshot.groups.map((group, index) => groupDisplayTitle(group.title, index));
  const maxMembers = snapshot.groups.reduce((max, group) => Math.max(max, group.members.length), 0);

  groupTitles.forEach((title, index) => {
    const column = byGroup.getColumn(index + 1);
    column.width = 22;
    const headerCell = byGroup.getRow(1).getCell(index + 1);
    headerCell.value = title;
  });
  applyHeaderRow(byGroup.getRow(1));
  byGroup.views = [{ state: "frozen", ySplit: 1 }];

  for (let memberIndex = 0; memberIndex < maxMembers; memberIndex += 1) {
    const row = byGroup.getRow(memberIndex + 2);
    snapshot.groups.forEach((group, groupIndex) => {
      const member = group.members[memberIndex];
      const cell = row.getCell(groupIndex + 1);
      if (!member) {
        styleDataCell(cell);
        return;
      }
      const fullName = `${member.firstName} ${member.lastName ?? ""}`.trim();
      const suffix = member.entity === "staff" ? " (Staff)" : "";
      cell.value = `${fullName}${suffix}`;
      styleDataCell(cell);
    });
  }

  if (groupTitles.length === 0) {
    byGroup.getColumn(1).width = 22;
    byGroup.getRow(1).getCell(1).value = "No groups";
    applyHeaderRow(byGroup.getRow(1));
  }

  return workbook;
}

export function groupingExportFilename(groupingName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${sanitizeFilename(groupingName)}-${date}.xlsx`;
}

export async function downloadGroupingWorkbook(snapshot: GroupingExportSnapshot): Promise<void> {
  const workbook = await buildGroupingWorkbook(snapshot);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = groupingExportFilename(snapshot.groupingName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
