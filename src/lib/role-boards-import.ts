import type ExcelJS from "exceljs";
import type { RoleBoardPerson, RoleBoardRow } from "../../drizzle/schema";
import {
  DEFAULT_ROLE_COLOR,
  ROLE_COLOR_PALETTE,
  normalizeResponsibilities,
  type RolePaletteColor,
} from "@/lib/role-boards";
import { levenshtein } from "@/lib/funnel/dedup";

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default;
}

export type RoleBoardImportPersonOption = {
  entity: "student" | "staff";
  id: number;
  firstName: string;
  lastName: string | null;
};

export type ImportedPersonMatch = {
  name: string;
  person: RoleBoardPerson | null;
  status: "matched" | "unmatched" | "ambiguous";
};

export type ImportedRolePreviewRow =
  | {
      kind: "subheader";
      name: string;
      color: RolePaletteColor;
    }
  | {
      kind: "role";
      name: string;
      responsibilities: string[];
      people: ImportedPersonMatch[];
      color: RolePaletteColor;
    };

export type RoleBoardImportPreview = {
  sourceLabel: string | null;
  personColumnCount: number;
  rows: ImportedRolePreviewRow[];
  roleCount: number;
  groupCount: number;
  matchedPeople: number;
  unmatchedPeople: number;
  ambiguousPeople: number;
};

function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result != null) return cellText(value.result as ExcelJS.CellValue);
    if ("hyperlink" in value) {
      const link = value as ExcelJS.CellHyperlinkValue;
      return typeof link.text === "string" ? link.text : String(link.hyperlink ?? "");
    }
  }
  return "";
}

function normalizePersonKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function optionDisplayName(option: RoleBoardImportPersonOption): string {
  return `${option.firstName} ${option.lastName ?? ""}`.trim();
}

/** Resolve a display name to a staff/student option. Prefers exact matches, then staff, then fuzzy. */
export function resolveImportPersonName(
  rawName: string,
  options: RoleBoardImportPersonOption[]
): ImportedPersonMatch {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) {
    return { name: "", person: null, status: "unmatched" };
  }

  const key = normalizePersonKey(name);
  const exact = options.filter((option) => normalizePersonKey(optionDisplayName(option)) === key);
  if (exact.length === 1) {
    return {
      name,
      person: { entity: exact[0]!.entity, id: exact[0]!.id },
      status: "matched",
    };
  }
  if (exact.length > 1) {
    const staff = exact.filter((option) => option.entity === "staff");
    if (staff.length === 1) {
      return {
        name,
        person: { entity: "staff", id: staff[0]!.id },
        status: "matched",
      };
    }
    return { name, person: null, status: "ambiguous" };
  }

  let best: RoleBoardImportPersonOption | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  let tie = false;
  for (const option of options) {
    const dist = levenshtein(key, normalizePersonKey(optionDisplayName(option)));
    const maxLen = Math.max(key.length, optionDisplayName(option).length, 1);
    if (dist > 2 || dist / maxLen > 0.25) continue;
    if (dist < bestDist) {
      best = option;
      bestDist = dist;
      tie = false;
    } else if (dist === bestDist) {
      tie = true;
    }
  }

  if (best && !tie) {
    return {
      name,
      person: { entity: best.entity, id: best.id },
      status: "matched",
    };
  }
  if (best && tie) {
    return { name, person: null, status: "ambiguous" };
  }
  return { name, person: null, status: "unmatched" };
}

export function splitPeopleCell(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function isTitleRow(role: string, people: string, responsibilities: string): boolean {
  const upper = role.trim().toUpperCase();
  if (upper === "ROLES & RESPONSIBILITIES") return true;
  if (upper === "NO ROLES YET") return true;
  if (!people && !responsibilities && /[–-]/.test(role) && /\d{4}/.test(role)) return true;
  return false;
}

function isMetaRow(role: string, people: string, responsibilities: string): boolean {
  if (responsibilities.trim()) return false;
  // View name + date range on row 2 of Fold exports.
  if (people.includes("–") || people.includes("-")) {
    if (/\d{4}-\d{2}-\d{2}/.test(people) || /\d{4}/.test(people)) return true;
  }
  if (!people && !responsibilities && /\d{4}-\d{2}-\d{2}/.test(role)) return true;
  return false;
}

function isSectionRow(role: string, people: string, responsibilities: string): boolean {
  if (!role.trim() || people.trim() || responsibilities.trim()) return false;
  const trimmed = role.trim();
  // Fold exports use uppercase section labels (ADMIN, TECH, …).
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;
  return false;
}

function sectionColor(index: number): RolePaletteColor {
  return ROLE_COLOR_PALETTE[index % ROLE_COLOR_PALETTE.length] ?? DEFAULT_ROLE_COLOR;
}

function findRolesRespSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  return (
    workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === "rolesresp") ??
    workbook.worksheets.find((sheet) => /roles?\s*&?\s*resp/i.test(sheet.name)) ??
    workbook.worksheets[0] ??
    null
  );
}

/**
 * Parse a Fold Roles `.xlsx` (RolesResp sheet) into a preview with person matches.
 */
export async function parseRoleBoardWorkbook(
  data: ArrayBuffer | Uint8Array | Buffer,
  personOptions: RoleBoardImportPersonOption[]
): Promise<RoleBoardImportPreview> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  // exceljs typings accept Buffer; browsers pass ArrayBuffer.
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);

  const sheet = findRolesRespSheet(workbook);
  if (!sheet) {
    throw new Error("Could not find a RolesResp sheet in this workbook");
  }

  const rows: ImportedRolePreviewRow[] = [];
  let sourceLabel: string | null = null;
  let sectionIndex = 0;
  let activeColor: RolePaletteColor = DEFAULT_ROLE_COLOR;
  let maxPeople = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const role = cellText(row.getCell(1).value).trim();
    const peopleRaw = cellText(row.getCell(2).value).trim();
    const responsibilitiesRaw = cellText(row.getCell(3).value);

    if (!role && !peopleRaw && !responsibilitiesRaw.trim()) return;
    if (isTitleRow(role, peopleRaw, responsibilitiesRaw)) return;

    if (rowNumber <= 3 && isMetaRow(role, peopleRaw, responsibilitiesRaw)) {
      if (role) sourceLabel = role;
      return;
    }

    if (isSectionRow(role, peopleRaw, responsibilitiesRaw)) {
      activeColor = sectionColor(sectionIndex);
      sectionIndex += 1;
      rows.push({
        kind: "subheader",
        name: role.trim(),
        color: activeColor,
      });
      return;
    }

    if (!role) return;

    const peopleNames = splitPeopleCell(peopleRaw);
    maxPeople = Math.max(maxPeople, peopleNames.length);
    const people = peopleNames.map((personName) =>
      resolveImportPersonName(personName, personOptions)
    );

    rows.push({
      kind: "role",
      name: role,
      responsibilities: normalizeResponsibilities(responsibilitiesRaw),
      people,
      color: activeColor,
    });
  });

  if (rows.length === 0) {
    throw new Error("No roles found in this workbook");
  }

  let matchedPeople = 0;
  let unmatchedPeople = 0;
  let ambiguousPeople = 0;
  let roleCount = 0;
  let groupCount = 0;
  for (const row of rows) {
    if (row.kind === "subheader") {
      groupCount += 1;
      continue;
    }
    roleCount += 1;
    for (const person of row.people) {
      if (person.status === "matched") matchedPeople += 1;
      else if (person.status === "ambiguous") ambiguousPeople += 1;
      else unmatchedPeople += 1;
    }
  }

  return {
    sourceLabel,
    personColumnCount: maxPeople,
    rows,
    roleCount,
    groupCount,
    matchedPeople,
    unmatchedPeople,
    ambiguousPeople,
  };
}

/** Convert a preview into board rows ready to save. */
export function roleBoardRowsFromImportPreview(
  preview: RoleBoardImportPreview
): { rows: RoleBoardRow[]; personColumnCount: number } {
  const personColumnCount = preview.personColumnCount;
  const rows: RoleBoardRow[] = preview.rows.map((row) => {
    if (row.kind === "subheader") {
      return { kind: "subheader", name: row.name, color: row.color };
    }
    const people: Array<RoleBoardPerson | null> = Array.from(
      { length: personColumnCount },
      (_, index) => row.people[index]?.person ?? null
    );
    return {
      kind: "role",
      name: row.name,
      responsibilities: row.responsibilities,
      color: row.color,
      people,
    };
  });
  return { rows, personColumnCount };
}
