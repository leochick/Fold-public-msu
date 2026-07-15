import type { RoleBoardPerson, RoleBoardRow } from "../../drizzle/schema";

export const DEFAULT_ROLE_COLOR = "#e5e7eb";

function isValidPerson(person: unknown): person is RoleBoardPerson {
  if (!person || typeof person !== "object") return false;
  const row = person as RoleBoardPerson;
  return (
    (row.entity === "student" || row.entity === "staff") && Number.isFinite(row.id)
  );
}

export function normalizeRoleColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_ROLE_COLOR;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
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
