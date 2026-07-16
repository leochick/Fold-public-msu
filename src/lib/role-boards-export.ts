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

/** Matches MSU Operations “RolesResp” / “Roles & Work Teams” styling. */
const FONT_NAME = "Roboto Condensed";
const TITLE_FILL = "FF93C47D";
const SECTION_FILL = "FFD9EAD3";
const WORK_TEAMS_HEADER_FILL = "FF38761D";
const WORK_TEAMS_HEADER_FONT = "FFFFFFFF";
const LINK_FONT = "FF0000FF";
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD0D0D0" } },
  bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
  left: { style: "thin", color: { argb: "FFD0D0D0" } },
  right: { style: "thin", color: { argb: "FFD0D0D0" } },
};

const WORK_TEAMS_BLOCKS_ACROSS = 3;

function personName(person: { firstName: string; lastName: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function formatPeopleCell(
  people: Array<RoleBoardExportPerson | null>,
  personColumnCount: number
): string {
  return people
    .slice(0, personColumnCount)
    .filter((person): person is RoleBoardExportPerson => person != null)
    .map(personName)
    .filter(Boolean)
    .join(", ");
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

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function roleDisplayName(name: string, index: number): string {
  const trimmed = name.trim();
  return trimmed || `Untitled role ${index + 1}`;
}

function applyTitleRow(row: ExcelJS.Row, columnCount: number) {
  for (let col = 1; col <= columnCount; col += 1) {
    const cell = row.getCell(col);
    cell.fill = solidFill(TITLE_FILL);
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: "FF000000" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }
  row.height = 20;
}

function applySectionFill(row: ExcelJS.Row, columnCount: number) {
  for (let col = 1; col <= columnCount; col += 1) {
    const cell = row.getCell(col);
    cell.fill = solidFill(SECTION_FILL);
  }
}

function styleBodyCell(cell: ExcelJS.Cell, options?: { bold?: boolean; link?: boolean }) {
  cell.font = {
    name: FONT_NAME,
    size: 10,
    bold: options?.bold ?? false,
    color: { argb: options?.link ? LINK_FONT : "FF000000" },
  };
  cell.alignment = { vertical: "bottom", horizontal: "left", wrapText: true };
}

function setDescriptionCell(cell: ExcelJS.Cell, description: string) {
  const trimmed = description.trim();
  if (!trimmed) {
    styleBodyCell(cell);
    cell.value = "";
    return;
  }
  if (looksLikeUrl(trimmed)) {
    cell.value = {
      text: trimmed,
      hyperlink: trimmed,
    };
    styleBodyCell(cell, { link: true });
    return;
  }
  styleBodyCell(cell);
  cell.value = trimmed;
}

export function buildRoleBoardTableRows(snapshot: RoleBoardExportSnapshot) {
  return snapshot.rows.map((row, index) => ({
    role: roleDisplayName(row.name, index),
    description: row.description,
    color: normalizeRoleColor(row.color),
    people: formatPeopleCell(row.people, snapshot.personColumnCount),
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

function buildRolesRespSheet(
  workbook: ExcelJS.Workbook,
  snapshot: RoleBoardExportSnapshot
) {
  const sheet = workbook.addWorksheet("RolesResp", {
    views: [{ showGridLines: true }],
  });
  sheet.columns = [
    { key: "role", width: 22 },
    { key: "people", width: 28 },
    { key: "description", width: 36 },
  ];

  const title = sheet.getRow(1);
  title.getCell(1).value = "ROLES & RESPONSIBILITIES";
  title.getCell(3).value = "DESCRIPTION";
  applyTitleRow(title, 3);

  const meta = sheet.getRow(2);
  meta.getCell(1).value = snapshot.viewName;
  meta.getCell(2).value = `${snapshot.viewFrom} – ${snapshot.viewTo}`;
  meta.getCell(1).font = { name: FONT_NAME, size: 10, bold: true };
  meta.getCell(2).font = { name: FONT_NAME, size: 10 };
  applySectionFill(meta, 3);
  meta.height = 18;

  const tableRows = buildRoleBoardTableRows(snapshot);
  if (tableRows.length === 0) {
    const row = sheet.getRow(3);
    row.getCell(1).value = "No roles yet";
    styleBodyCell(row.getCell(1));
    styleBodyCell(row.getCell(2));
    styleBodyCell(row.getCell(3));
    return sheet;
  }

  tableRows.forEach((data, index) => {
    const source = snapshot.rows[index];
    const row = sheet.getRow(index + 3);
    const roleCell = row.getCell(1);
    const peopleCell = row.getCell(2);
    const descriptionCell = row.getCell(3);

    roleCell.value = data.role;
    peopleCell.value = data.people;
    setDescriptionCell(descriptionCell, data.description);

    styleBodyCell(roleCell, { bold: true });
    styleBodyCell(peopleCell);
    if (source) {
      const bg = hexToArgb(source.color);
      roleCell.fill = solidFill(bg);
      roleCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: hexToArgb(contrastingTextColor(source.color)) },
      };
    }
    roleCell.border = THIN_BORDER;
    peopleCell.border = THIN_BORDER;
    descriptionCell.border = THIN_BORDER;
    row.height = 18;
  });

  return sheet;
}

function buildRolesAndWorkTeamsSheet(
  workbook: ExcelJS.Workbook,
  snapshot: RoleBoardExportSnapshot
) {
  const sheet = workbook.addWorksheet("Roles & Work Teams", {
    views: [{ showGridLines: true }],
  });

  const tableRows = buildRoleBoardTableRows(snapshot);
  const blockCount = Math.max(
    1,
    Math.min(WORK_TEAMS_BLOCKS_ACROSS, Math.max(tableRows.length, 1))
  );
  const rowsPerBlock = Math.max(1, Math.ceil(Math.max(tableRows.length, 1) / blockCount));

  for (let block = 0; block < blockCount; block += 1) {
    const roleCol = block * 2 + 1;
    const peopleCol = block * 2 + 2;
    sheet.getColumn(roleCol).width = 22;
    sheet.getColumn(peopleCol).width = 24;
  }

  const header = sheet.getRow(1);
  header.getCell(1).value = "ROLES & WORK TEAMS";
  header.getCell(2).value = snapshot.viewName;
  for (let col = 1; col <= blockCount * 2; col += 1) {
    const cell = header.getCell(col);
    cell.fill = solidFill(WORK_TEAMS_HEADER_FILL);
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: WORK_TEAMS_HEADER_FONT },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }
  header.height = 20;

  const columnHeaders = sheet.getRow(2);
  for (let block = 0; block < blockCount; block += 1) {
    const roleCol = block * 2 + 1;
    const peopleCol = block * 2 + 2;
    columnHeaders.getCell(roleCol).value = "Role";
    columnHeaders.getCell(peopleCol).value = "People";
    for (const col of [roleCol, peopleCol]) {
      const cell = columnHeaders.getCell(col);
      cell.fill = solidFill(SECTION_FILL);
      cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: "FF000000" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }
  }
  columnHeaders.height = 18;

  if (tableRows.length === 0) {
    const row = sheet.getRow(3);
    row.getCell(1).value = "No roles yet";
    styleBodyCell(row.getCell(1));
    return sheet;
  }

  tableRows.forEach((data, index) => {
    const source = snapshot.rows[index];
    const block = Math.floor(index / rowsPerBlock);
    const rowInBlock = index % rowsPerBlock;
    const excelRow = sheet.getRow(rowInBlock + 3);
    const roleCol = block * 2 + 1;
    const peopleCol = block * 2 + 2;

    const roleCell = excelRow.getCell(roleCol);
    const peopleCell = excelRow.getCell(peopleCol);
    roleCell.value = data.role;
    peopleCell.value = data.people;

    styleBodyCell(roleCell, { bold: true });
    styleBodyCell(peopleCell);

    if (source) {
      const bg = hexToArgb(source.color);
      roleCell.fill = solidFill(bg);
      roleCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: hexToArgb(contrastingTextColor(source.color)) },
      };
    }

    roleCell.border = THIN_BORDER;
    peopleCell.border = THIN_BORDER;
    if (!excelRow.height || excelRow.height < 18) excelRow.height = 18;
  });

  return sheet;
}

export async function buildRoleBoardWorkbook(
  snapshot: RoleBoardExportSnapshot
): Promise<ExcelJS.Workbook> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fold";
  workbook.created = new Date();
  workbook.modified = new Date();

  buildRolesRespSheet(workbook, snapshot);
  buildRolesAndWorkTeamsSheet(workbook, snapshot);

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
