import type ExcelJS from "exceljs";
import type { RoleBoardPerson } from "../../drizzle/schema";
import {
  formatResponsibilitiesText,
  normalizeRoleColor,
  type RolePaletteColor,
} from "@/lib/role-boards";

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
  groupName: string | null;
  responsibilities: string[];
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
const LEFT_BORDER: Partial<ExcelJS.Borders> = {
  left: { style: "thin", color: { argb: "FF000000" } },
};

/** Saturated Excel fills for UI pastel palette (from MSU Operations workbook). */
const EXCEL_COLOR_BY_PALETTE: Record<RolePaletteColor, string> = {
  "#e5e7eb": "FF666666",
  "#d4d4d8": "FF999999",
  "#93c5fd": "FF6FA8DC",
  "#7dd3fc": "FF76A5AF",
  "#67e8f9": "FF45818E",
  "#5eead4": "FF0B8043",
  "#86efac": "FF6AA84F",
  "#a3e635": "FF38761D",
  "#fcd34d": "FFB45F06",
  "#fdba74": "FFB45F06",
  "#fda4af": "FFCC4125",
  "#f9a8d4": "FFC27BA0",
};

const WORK_TEAMS_GROUPS_PER_BAND = 6;
const ROLE_COL_WIDTH = 17.25;
const PEOPLE_COL_WIDTH = 14;

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

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Map UI pastel palette colors to saturated Excel ARGB fills. */
export function excelFillForRoleColor(hex: string): string {
  const normalized = normalizeRoleColor(hex);
  return EXCEL_COLOR_BY_PALETTE[normalized] ?? "FF666666";
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function roleDisplayName(name: string, index: number): string {
  const trimmed = name.trim();
  return trimmed || `Untitled role ${index + 1}`;
}

function roleSheetName(row: RoleBoardExportRow, index: number): string {
  const role = roleDisplayName(row.name, index);
  const group = row.groupName?.trim();
  return group ? `${group} - ${role}` : role;
}

function formatResponsibilitiesForExport(items: string[]): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.map((item) => `• ${item}`).join("\n");
}

function applyTitleRow(row: ExcelJS.Row, columnCount: number) {
  for (let col = 1; col <= columnCount; col += 1) {
    const cell = row.getCell(col);
    cell.fill = solidFill(TITLE_FILL);
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: "FF000000" } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
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

function setResponsibilitiesCell(cell: ExcelJS.Cell, responsibilities: string[]) {
  const cleaned = responsibilities.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    styleBodyCell(cell);
    cell.value = "";
    return;
  }
  if (cleaned.length === 1 && looksLikeUrl(cleaned[0])) {
    const url = cleaned[0];
    cell.value = {
      text: url,
      hyperlink: url,
    };
    styleBodyCell(cell, { link: true });
    return;
  }
  styleBodyCell(cell);
  cell.value = formatResponsibilitiesForExport(cleaned);
}

export type WorkTeamGroup = {
  name: string;
  color: string;
  roles: Array<{ role: string; people: string }>;
};

/** Group roles by contiguous subheader runs for the Work Teams sheet layout. */
export function buildWorkTeamGroups(snapshot: RoleBoardExportSnapshot): WorkTeamGroup[] {
  const groups: WorkTeamGroup[] = [];

  snapshot.rows.forEach((row, index) => {
    const groupName = row.groupName?.trim() || "Roles";
    const color = normalizeRoleColor(row.color);
    const current = groups[groups.length - 1];
    if (!current || current.name !== groupName) {
      groups.push({
        name: groupName,
        color,
        roles: [],
      });
    }

    groups[groups.length - 1].roles.push({
      role: roleDisplayName(row.name, index),
      people: formatPeopleCell(row.people, snapshot.personColumnCount),
    });
  });

  return groups;
}

export function buildRoleBoardTableRows(snapshot: RoleBoardExportSnapshot) {
  return snapshot.rows.map((row, index) => ({
    role: roleSheetName(row, index),
    groupName: row.groupName?.trim() || null,
    responsibilities: formatResponsibilitiesText(row.responsibilities),
    color: normalizeRoleColor(row.color),
    people: formatPeopleCell(row.people, snapshot.personColumnCount),
  }));
}

export function buildRoleAssignmentRows(snapshot: RoleBoardExportSnapshot) {
  const rows: Array<{
    role: string;
    responsibilities: string;
    person: string;
    type: string;
    column: number;
  }> = [];

  snapshot.rows.forEach((row, index) => {
    const role = roleSheetName(row, index);
    row.people.forEach((person, personIndex) => {
      if (!person || personIndex >= snapshot.personColumnCount) return;
      rows.push({
        role,
        responsibilities: formatResponsibilitiesText(row.responsibilities),
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
    groupName?: string | null;
    responsibilities: string[];
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
    groupName: row.groupName?.trim() ? row.groupName.trim() : null,
    responsibilities: row.responsibilities,
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
    { key: "responsibilities", width: 36 },
  ];

  const title = sheet.getRow(1);
  title.getCell(1).value = "ROLES & RESPONSIBILITIES";
  title.getCell(3).value = "RESPONSIBILITIES";
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

  let excelRowIndex = 3;
  let lastGroupKey: string | null = null;

  tableRows.forEach((data, index) => {
    const source = snapshot.rows[index];
    const groupKey = data.groupName ?? "";
    if (groupKey && groupKey !== lastGroupKey) {
      const section = sheet.getRow(excelRowIndex);
      section.getCell(1).value = groupKey.toUpperCase();
      applySectionFill(section, 3);
      section.getCell(1).font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: "FF000000" },
      };
      section.getCell(1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      section.height = 18;
      excelRowIndex += 1;
      lastGroupKey = groupKey;
    }

    const row = sheet.getRow(excelRowIndex);
    const roleCell = row.getCell(1);
    const peopleCell = row.getCell(2);
    const responsibilitiesCell = row.getCell(3);

    roleCell.value = roleDisplayName(source?.name ?? data.role, index);
    peopleCell.value = data.people;
    setResponsibilitiesCell(responsibilitiesCell, source?.responsibilities ?? []);

    styleBodyCell(roleCell, { bold: true });
    styleBodyCell(peopleCell);
    row.height = 18;
    excelRowIndex += 1;
  });

  return sheet;
}

function applyWorkTeamCategoryCell(
  cell: ExcelJS.Cell,
  value: string | null,
  fillArgb: string,
  withLeftBorder: boolean
) {
  if (value != null) cell.value = value;
  cell.fill = solidFill(fillArgb);
  cell.font = {
    name: FONT_NAME,
    size: 10,
    bold: Boolean(value),
    color: { argb: WORK_TEAMS_HEADER_FONT },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  if (withLeftBorder) cell.border = LEFT_BORDER;
}

function applyWorkTeamHeaderCell(
  cell: ExcelJS.Cell,
  value: string,
  withLeftBorder: boolean
) {
  cell.value = value;
  cell.fill = solidFill(WORK_TEAMS_HEADER_FILL);
  cell.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: WORK_TEAMS_HEADER_FONT },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  if (withLeftBorder) cell.border = LEFT_BORDER;
}

function buildRolesAndWorkTeamsSheet(
  workbook: ExcelJS.Workbook,
  snapshot: RoleBoardExportSnapshot
) {
  const sheet = workbook.addWorksheet("Roles & Work Teams", {
    views: [{ showGridLines: true }],
  });

  const groups = buildWorkTeamGroups(snapshot);
  if (groups.length === 0) {
    sheet.getColumn(1).width = ROLE_COL_WIDTH;
    sheet.getColumn(2).width = PEOPLE_COL_WIDTH;
    applyWorkTeamHeaderCell(sheet.getRow(1).getCell(1), "Roles", false);
    applyWorkTeamHeaderCell(sheet.getRow(1).getCell(2), "", true);
    const empty = sheet.getRow(2);
    empty.getCell(1).value = "No roles yet";
    styleBodyCell(empty.getCell(1), { bold: true });
    empty.getCell(1).border = LEFT_BORDER;
    return sheet;
  }

  const maxCol = Math.min(groups.length, WORK_TEAMS_GROUPS_PER_BAND) * 2;
  for (let col = 1; col <= maxCol; col += 1) {
    sheet.getColumn(col).width = col % 2 === 1 ? ROLE_COL_WIDTH : PEOPLE_COL_WIDTH;
  }

  let excelRowIndex = 1;
  for (
    let bandStart = 0;
    bandStart < groups.length;
    bandStart += WORK_TEAMS_GROUPS_PER_BAND
  ) {
    if (bandStart > 0) excelRowIndex += 1;

    const band = groups.slice(bandStart, bandStart + WORK_TEAMS_GROUPS_PER_BAND);
    const categoryRow = sheet.getRow(excelRowIndex);
    const headerRow = sheet.getRow(excelRowIndex + 1);

    band.forEach((group, blockIndex) => {
      const roleCol = blockIndex * 2 + 1;
      const peopleCol = blockIndex * 2 + 2;
      const fill = excelFillForRoleColor(group.color);

      applyWorkTeamCategoryCell(categoryRow.getCell(roleCol), group.name.toUpperCase(), fill, true);
      applyWorkTeamCategoryCell(categoryRow.getCell(peopleCol), null, fill, false);
      applyWorkTeamHeaderCell(headerRow.getCell(roleCol), group.name, true);
      applyWorkTeamHeaderCell(headerRow.getCell(peopleCol), "", false);
    });

    const dataStart = excelRowIndex + 2;
    const maxRoles = Math.max(1, ...band.map((group) => group.roles.length));

    for (let roleIndex = 0; roleIndex < maxRoles; roleIndex += 1) {
      const row = sheet.getRow(dataStart + roleIndex);
      band.forEach((group, blockIndex) => {
        const roleCol = blockIndex * 2 + 1;
        const peopleCol = blockIndex * 2 + 2;
        const entry = group.roles[roleIndex];
        const roleCell = row.getCell(roleCol);
        const peopleCell = row.getCell(peopleCol);

        roleCell.value = entry?.role ?? "";
        peopleCell.value = entry?.people ?? "";
        styleBodyCell(roleCell, { bold: true });
        styleBodyCell(peopleCell);
        roleCell.border = LEFT_BORDER;
      });
    }

    excelRowIndex = dataStart + maxRoles;
  }

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
