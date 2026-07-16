import type {
  RoleBoardPerson,
  RoleBoardRoleRow,
  RoleBoardRow,
  RoleBoardSubheaderRow,
} from "../../drizzle/schema";

/** Fixed palette for role chip backgrounds. */
export const ROLE_COLOR_PALETTE = [
  "#e5e7eb", // gray
  "#d4d4d8", // zinc
  "#93c5fd", // blue
  "#7dd3fc", // sky
  "#67e8f9", // cyan
  "#5eead4", // teal
  "#86efac", // green
  "#a3e635", // lime
  "#fcd34d", // amber
  "#fdba74", // orange
  "#fda4af", // rose
  "#f9a8d4", // pink
] as const;

export type RolePaletteColor = (typeof ROLE_COLOR_PALETTE)[number];

export const DEFAULT_ROLE_COLOR: RolePaletteColor = ROLE_COLOR_PALETTE[0];

const PALETTE_SET = new Set<string>(ROLE_COLOR_PALETTE);

function isValidPerson(person: unknown): person is RoleBoardPerson {
  if (!person || typeof person !== "object") return false;
  const row = person as RoleBoardPerson;
  return (
    (row.entity === "student" || row.entity === "staff") && Number.isFinite(row.id)
  );
}

export function normalizeRoleColor(value: unknown): RolePaletteColor {
  if (typeof value !== "string") return DEFAULT_ROLE_COLOR;
  const trimmed = value.trim().toLowerCase();
  let hex = trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    hex = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (PALETTE_SET.has(hex)) return hex as RolePaletteColor;
  return DEFAULT_ROLE_COLOR;
}

/** Pick black or white text for contrast against a hex background. */
export function contrastingTextColor(hex: string): string {
  const normalized = normalizeRoleColor(hex).slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

export function emptyRoleBoardRows(): RoleBoardRow[] {
  return [];
}

export function isRoleBoardSubheader(row: RoleBoardRow): row is RoleBoardSubheaderRow {
  return row.kind === "subheader";
}

export function isRoleBoardRole(row: RoleBoardRow): row is RoleBoardRoleRow {
  return row.kind !== "subheader";
}

/** Split a plain/legacy description string into responsibility bullets. */
function responsibilitiesFromText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[•\-\*]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Normalize responsibilities from the current field, or migrate legacy
 * `description` strings stored in older role board JSON.
 */
export function normalizeResponsibilities(
  responsibilities: unknown,
  legacyDescription?: unknown
): string[] {
  if (Array.isArray(responsibilities)) {
    return responsibilities
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof responsibilities === "string") {
    return responsibilitiesFromText(responsibilities);
  }
  if (typeof legacyDescription === "string") {
    return responsibilitiesFromText(legacyDescription);
  }
  return [];
}

/** Plain multiline text for export / tooltips without bullet markers. */
export function formatResponsibilitiesText(items: string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}

/** Bullet-prefixed multiline text for hover tooltips. */
export function formatResponsibilitiesTooltip(items: string[]): string | undefined {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return undefined;
  return cleaned.map((item) => `• ${item}`).join("\n");
}

function normalizePeople(
  rawPeople: unknown,
  columnCount: number
): Array<RoleBoardPerson | null> {
  const people: Array<RoleBoardPerson | null> = [];
  const list = Array.isArray(rawPeople) ? rawPeople : [];
  for (let i = 0; i < columnCount; i += 1) {
    const person = list[i];
    people.push(isValidPerson(person) ? person : null);
  }
  return people;
}

export function normalizeRoleBoardRows(
  rows: unknown,
  personColumnCount: number
): RoleBoardRow[] {
  const columnCount = Math.max(0, Math.floor(personColumnCount) || 0);
  if (!Array.isArray(rows)) return emptyRoleBoardRows();

  return rows.map((raw) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as {
      kind?: unknown;
      name?: unknown;
      responsibilities?: unknown;
      description?: unknown;
      color?: unknown;
      people?: unknown;
    };
    const name = typeof row.name === "string" ? row.name : "";
    const color = normalizeRoleColor(row.color);

    if (row.kind === "subheader") {
      return { kind: "subheader", name, color } satisfies RoleBoardSubheaderRow;
    }

    return {
      kind: "role",
      name,
      responsibilities: normalizeResponsibilities(row.responsibilities, row.description),
      color,
      people: normalizePeople(row.people, columnCount),
    } satisfies RoleBoardRoleRow;
  });
}

/**
 * Walk board rows top-to-bottom, tracking the active subheader grouping.
 * Roles inherit the nearest preceding subheader's name and color.
 */
export function resolveRoleBoardRoleEntries(rows: RoleBoardRow[]): Array<{
  row: RoleBoardRoleRow;
  groupName: string | null;
  color: string;
  displayName: string;
}> {
  let groupName: string | null = null;
  let groupColor: string | null = null;
  const entries: Array<{
    row: RoleBoardRoleRow;
    groupName: string | null;
    color: string;
    displayName: string;
  }> = [];

  for (const row of rows) {
    if (isRoleBoardSubheader(row)) {
      const trimmed = row.name.trim();
      groupName = trimmed || null;
      groupColor = normalizeRoleColor(row.color);
      continue;
    }

    const roleName = row.name.trim() || "Untitled role";
    const displayName = groupName ? `${groupName} - ${roleName}` : roleName;
    entries.push({
      row,
      groupName,
      color: groupColor ?? normalizeRoleColor(row.color),
      displayName,
    });
  }

  return entries;
}

export function personKey(person: RoleBoardPerson) {
  return `${person.entity}:${person.id}`;
}

export function parsePersonKey(key: string): RoleBoardPerson | null {
  const [entity, idRaw] = key.split(":");
  const id = Number(idRaw);
  if ((entity !== "student" && entity !== "staff") || !Number.isFinite(id)) {
    return null;
  }
  return { entity, id };
}
