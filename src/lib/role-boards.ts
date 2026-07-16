import type { RoleBoardPerson, RoleBoardRow } from "../../drizzle/schema";

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

export function normalizeRoleBoardRows(
  rows: unknown,
  personColumnCount: number
): RoleBoardRow[] {
  const columnCount = Math.max(0, Math.floor(personColumnCount) || 0);
  if (!Array.isArray(rows)) return emptyRoleBoardRows();

  return rows.map((raw) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as {
      name?: unknown;
      description?: unknown;
      color?: unknown;
      people?: unknown;
    };
    const name = typeof row.name === "string" ? row.name : "";
    const description = typeof row.description === "string" ? row.description : "";
    const color = normalizeRoleColor(row.color);
    const rawPeople = Array.isArray(row.people) ? row.people : [];
    const people: Array<RoleBoardPerson | null> = [];
    for (let i = 0; i < columnCount; i += 1) {
      const person = rawPeople[i];
      people.push(isValidPerson(person) ? person : null);
    }
    return { name, description, color, people };
  });
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
