import type ExcelJS from "exceljs";
import type { StaffAllocationItem } from "@/server/staff-allocation";

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default;
}

export type StaffAllocationExportSnapshot = {
  viewName: string;
  viewFrom: string;
  viewTo: string;
  staff: StaffAllocationItem[];
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

const STAFF_HEADERS = [
  "Staff",
  "First Name",
  "Last Name",
  "Gender",
  "Assigned",
  "Roles",
  "Role Count",
  "Grouping Placements",
  "Students Across Groupings",
] as const;

const ROLE_HEADERS = ["Staff", "Role"] as const;

const GROUPING_HEADERS = [
  "Staff",
  "Grouping",
  "Container",
  "Student Count",
  "Students",
] as const;

function personName(person: { firstName: string; lastName: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return cleaned || "staff-allocation";
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

function uniqueStudentCount(member: StaffAllocationItem): number {
  const ids = new Set<number>();
  for (const grouping of member.groupings) {
    for (const student of grouping.students) ids.add(student.id);
  }
  return ids.size;
}

export function buildStaffOverviewRows(snapshot: StaffAllocationExportSnapshot) {
  return snapshot.staff.map((member) => {
    const assigned = member.roles.length + member.groupings.length > 0;
    return {
      staff: personName(member),
      firstName: member.firstName,
      lastName: member.lastName ?? "",
      gender: member.gender ?? "",
      assigned: assigned ? "Yes" : "No",
      roles: member.roles.map((role) => role.roleName).join(", "),
      roleCount: member.roles.length,
      groupingPlacements: member.groupings.length,
      studentsAcrossGroupings: uniqueStudentCount(member),
    };
  });
}

export function buildStaffRoleRows(snapshot: StaffAllocationExportSnapshot) {
  const rows: Array<{ staff: string; role: string }> = [];
  for (const member of snapshot.staff) {
    for (const role of member.roles) {
      rows.push({
        staff: personName(member),
        role: role.roleName,
      });
    }
  }
  return rows;
}

export function buildStaffGroupingRows(snapshot: StaffAllocationExportSnapshot) {
  const rows: Array<{
    staff: string;
    grouping: string;
    container: string;
    studentCount: number;
    students: string;
  }> = [];

  for (const member of snapshot.staff) {
    for (const grouping of member.groupings) {
      rows.push({
        staff: personName(member),
        grouping: grouping.groupingName,
        container: grouping.containerTitle,
        studentCount: grouping.students.length,
        students: grouping.students.map(personName).join(", "),
      });
    }
  }

  return rows;
}

export async function buildStaffAllocationWorkbook(
  snapshot: StaffAllocationExportSnapshot
): Promise<ExcelJS.Workbook> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fold";
  workbook.created = new Date();
  workbook.modified = new Date();

  const exportedAt = new Date().toLocaleString();
  const assignedCount = snapshot.staff.filter(
    (member) => member.roles.length + member.groupings.length > 0
  ).length;
  const roleAssignments = buildStaffRoleRows(snapshot).length;
  const groupingPlacements = buildStaffGroupingRows(snapshot).length;

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  summary.columns = [
    { key: "label", width: 28 },
    { key: "value", width: 56 },
  ];

  const summaryRows: Array<[string, string | number]> = [
    ["View", snapshot.viewName],
    ["Date range", `${snapshot.viewFrom} – ${snapshot.viewTo}`],
    ["Staff total", snapshot.staff.length],
    ["Staff assigned", assignedCount],
    ["Staff unassigned", snapshot.staff.length - assignedCount],
    ["Role assignments", roleAssignments],
    ["Grouping placements", groupingPlacements],
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

  const staffSheet = workbook.addWorksheet("Staff");
  staffSheet.columns = [
    { key: "staff", width: 22 },
    { key: "firstName", width: 14 },
    { key: "lastName", width: 14 },
    { key: "gender", width: 10 },
    { key: "assigned", width: 10 },
    { key: "roles", width: 36 },
    { key: "roleCount", width: 12 },
    { key: "groupingPlacements", width: 18 },
    { key: "studentsAcrossGroupings", width: 22 },
  ];

  const staffHeader = staffSheet.getRow(1);
  STAFF_HEADERS.forEach((header, index) => {
    staffHeader.getCell(index + 1).value = header;
  });
  applyHeaderRow(staffHeader);
  staffSheet.views = [{ state: "frozen", ySplit: 1 }];
  staffSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: STAFF_HEADERS.length },
  };

  buildStaffOverviewRows(snapshot).forEach((data, index) => {
    const row = staffSheet.getRow(index + 2);
    row.values = [
      data.staff,
      data.firstName,
      data.lastName,
      data.gender,
      data.assigned,
      data.roles,
      data.roleCount,
      data.groupingPlacements,
      data.studentsAcrossGroupings,
    ];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      styleDataCell(cell, {
        center: colNumber === 4 || colNumber === 5 || colNumber === 7 || colNumber === 8 || colNumber === 9,
      });
    });
  });

  const rolesSheet = workbook.addWorksheet("Roles");
  rolesSheet.columns = [
    { key: "staff", width: 22 },
    { key: "role", width: 28 },
  ];
  const rolesHeader = rolesSheet.getRow(1);
  ROLE_HEADERS.forEach((header, index) => {
    rolesHeader.getCell(index + 1).value = header;
  });
  applyHeaderRow(rolesHeader);
  rolesSheet.views = [{ state: "frozen", ySplit: 1 }];
  rolesSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ROLE_HEADERS.length },
  };

  const roleRows = buildStaffRoleRows(snapshot);
  if (roleRows.length === 0) {
    const row = rolesSheet.getRow(2);
    row.values = ["—", "No role assignments"];
    row.eachCell({ includeEmpty: true }, (cell) => styleDataCell(cell));
  } else {
    roleRows.forEach((data, index) => {
      const row = rolesSheet.getRow(index + 2);
      row.values = [data.staff, data.role];
      row.eachCell({ includeEmpty: true }, (cell) => styleDataCell(cell));
    });
  }

  const groupingsSheet = workbook.addWorksheet("Groupings");
  groupingsSheet.columns = [
    { key: "staff", width: 22 },
    { key: "grouping", width: 24 },
    { key: "container", width: 20 },
    { key: "studentCount", width: 14 },
    { key: "students", width: 48 },
  ];
  const groupingsHeader = groupingsSheet.getRow(1);
  GROUPING_HEADERS.forEach((header, index) => {
    groupingsHeader.getCell(index + 1).value = header;
  });
  applyHeaderRow(groupingsHeader);
  groupingsSheet.views = [{ state: "frozen", ySplit: 1 }];
  groupingsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: GROUPING_HEADERS.length },
  };

  const groupingRows = buildStaffGroupingRows(snapshot);
  if (groupingRows.length === 0) {
    const row = groupingsSheet.getRow(2);
    row.values = ["—", "—", "—", 0, "No grouping placements"];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      styleDataCell(cell, { center: colNumber === 4 });
    });
  } else {
    groupingRows.forEach((data, index) => {
      const row = groupingsSheet.getRow(index + 2);
      row.values = [
        data.staff,
        data.grouping,
        data.container,
        data.studentCount,
        data.students,
      ];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styleDataCell(cell, { center: colNumber === 4 });
      });
    });
  }

  return workbook;
}

export function staffAllocationExportFilename(viewName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `Staff-Allocation-${sanitizeFilename(viewName)}-${date}.xlsx`;
}

export async function downloadStaffAllocationWorkbook(
  snapshot: StaffAllocationExportSnapshot
): Promise<void> {
  const workbook = await buildStaffAllocationWorkbook(snapshot);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = staffAllocationExportFilename(snapshot.viewName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
