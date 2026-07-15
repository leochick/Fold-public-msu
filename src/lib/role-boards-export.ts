import type ExcelJS from "exceljs";
import type { RoleBoardPerson } from "../../drizzle/schema";
import { contrastingTextColor, normalizeRoleColor } from "@/lib/role-boards";

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default;
}

export type RoleBoardExportPerson = {
  entity: "student" | "staff";
  id: number;
  firstName: string;
  lastName: string | null;
};

export type RoleBoardExportRow = {
  name: string;
  description: string;
  color: string;
  people: Array<RoleBoardExportPerson | null>;
};

export type RoleBoardExportSnapshot = {
  viewName: string;
  viewFrom: string;
  viewTo: string;
  personColumnCount: number;
  rows: RoleBoardExportRow[];
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

function personName(person: { firstName: string; lastName: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function formatPersonCell(person: RoleBoardExportPerson | null): string {
  if (!person) return "";
  const name = personName(person);
  const type = person.entity === "staff" ? "Staff" : "Student";
  return name ? `${name} (${type})` : type;
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return cleaned || "roles";
}

function hexToArgb(hex: string): string {
  return `FF${normalizeRoleColor(hex).slice(1).toUpperCase()}`;
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

function roleDisplayName(name: string, index: number): string {
  const trimmed = name.trim();
  return trimmed || `Untitled role ${index + 1}`;
}

export function buildRoleBoardTableRows(snapshot: RoleBoardExportSnapshot) {
  return snapshot.rows.map((row, index) => ({
    role: roleDisplayName(row.name, index),
    description: row.description,
    color: normalizeRoleColor(row.color),
    people: Array.from({ length: snapshot.personColumnCount }, (_, personIndex) =>
      formatPersonCell(row.people[personIndex] ?? null)
    ),
  }));
}

export function buildRoleAssignmentRows(snapshot: RoleBoardExportSnapshot) {
  const rows: Array<{
    role: string;
    description: string;
    person: string;
    type: string;
    column: number;
  }> = [];

  snapshot.rows.forEach((row, index) => {
    const role = roleDisplayName(row.name, index);
    row.people.forEach((person, personIndex) => {
      if (!person || personIndex >= snapshot.personColumnCount) return;
      rows.push({
        role,
        description: row.description,
        person: personName(person),
        type: person.entity === "staff" ? "Staff" : "Student",
        column: personIndex + 1,
      });
    });
  });

  return rows;
}

export function resolveRoleBoardExportRows(
  rows: Array<{
    name: string;
    description: string;
    color: string;
    people: Array<RoleBoardPerson | null>;
  }>,
  personColumnCount: number,
  personOptions: RoleBoardExportPerson[]
): RoleBoardExportRow[] {
  const byKey = new Map(
    personOptions.map((person) => [`${person.entity}:${person.id}`, person] as const)
  );

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    color: row.color,
    people: Array.from({ length: personColumnCount }, (_, index) => {
      const person = row.people[index] ?? null;
      if (!person) return null;
      return byKey.get(`${person.entity}:${person.id}`) ?? {
        entity: person.entity,
        id: person.id,
        firstName: person.entity === "staff" ? "Staff" : "Student",
        lastName: `#${person.id}`,
      };
    }),
  }));
}

export async function buildRoleBoardWorkbook(
  snapshot: RoleBoardExportSnapshot
): Promise<ExcelJS.Workbook> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fold";
  workbook.created = new Date();
  workbook.modified = new Date();

  const exportedAt = new Date().toLocaleString();
  const assignmentCount = buildRoleAssignmentRows(snapshot).length;
  const filledPeople = snapshot.rows.reduce(
    (count, row) =>
      count +
      row.people
        .slice(0, snapshot.personColumnCount)
        .filter((person) => person != null).length,
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
    ["View", snapshot.viewName],
    ["Date range", `${snapshot.viewFrom} – ${snapshot.viewTo}`],
    ["Roles", snapshot.rows.length],
    ["Person columns", snapshot.personColumnCount],
    ["People assigned", filledPeople],
    ["Assignments", assignmentCount],
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

  const roleHeaders = [
    "Role",
    "Description",
    "Color",
    ...Array.from({ length: snapshot.personColumnCount }, (_, index) => `Person ${index + 1}`),
  ];

  const rolesSheet = workbook.addWorksheet("Roles");
  rolesSheet.columns = [
    { key: "role", width: 22 },
    { key: "description", width: 32 },
    { key: "color", width: 12 },
    ...Array.from({ length: snapshot.personColumnCount }, (_, index) => ({
      key: `person${index + 1}`,
      width: 24,
    })),
  ];

  const rolesHeader = rolesSheet.getRow(1);
  roleHeaders.forEach((header, index) => {
    rolesHeader.getCell(index + 1).value = header;
  });
  applyHeaderRow(rolesHeader);
  rolesSheet.views = [{ state: "frozen", ySplit: 1 }];
  rolesSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(roleHeaders.length, 1) },
  };

  const tableRows = buildRoleBoardTableRows(snapshot);
  if (tableRows.length === 0) {
    const row = rolesSheet.getRow(2);
    row.values = ["No roles yet", "", ""];
    row.eachCell({ includeEmpty: true }, (cell) => styleDataCell(cell));
  } else {
    tableRows.forEach((data, index) => {
      const source = snapshot.rows[index];
      const row = rolesSheet.getRow(index + 2);
      row.values = [data.role, data.description, data.color, ...data.people];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styleDataCell(cell, { center: colNumber === 3 });
        if (colNumber === 1 && source) {
          const bg = hexToArgb(source.color);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bg },
          };
          cell.font = {
            color: { argb: hexToArgb(contrastingTextColor(source.color)) },
          };
        }
      });
    });
  }

  const assignmentHeaders = ["Role", "Description", "Person", "Type", "Column"] as const;
  const assignmentsSheet = workbook.addWorksheet("Assignments");
  assignmentsSheet.columns = [
    { key: "role", width: 22 },
    { key: "description", width: 32 },
    { key: "person", width: 22 },
    { key: "type", width: 10 },
    { key: "column", width: 10 },
  ];

  const assignmentsHeader = assignmentsSheet.getRow(1);
  assignmentHeaders.forEach((header, index) => {
    assignmentsHeader.getCell(index + 1).value = header;
  });
  applyHeaderRow(assignmentsHeader);
  assignmentsSheet.views = [{ state: "frozen", ySplit: 1 }];
  assignmentsSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: assignmentHeaders.length },
  };

  const assignmentRows = buildRoleAssignmentRows(snapshot);
  if (assignmentRows.length === 0) {
    const row = assignmentsSheet.getRow(2);
    row.values = ["—", "—", "No assignments", "—", ""];
    row.eachCell({ includeEmpty: true }, (cell) => styleDataCell(cell));
  } else {
    assignmentRows.forEach((data, index) => {
      const row = assignmentsSheet.getRow(index + 2);
      row.values = [data.role, data.description, data.person, data.type, data.column];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styleDataCell(cell, { center: colNumber === 4 || colNumber === 5 });
      });
    });
  }

  return workbook;
}

export function roleBoardExportFilename(viewName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `Roles-${sanitizeFilename(viewName)}-${date}.xlsx`;
}

export async function downloadRoleBoardWorkbook(
  snapshot: RoleBoardExportSnapshot
): Promise<void> {
  const workbook = await buildRoleBoardWorkbook(snapshot);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = roleBoardExportFilename(snapshot.viewName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
