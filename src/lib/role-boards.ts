import type { RoleBoardPerson, RoleBoardRow } from "../../drizzle/schema";

function isValidPerson(person: unknown): person is RoleBoardPerson {
  if (!person || typeof person !== "object") return false;
  const row = person as RoleBoardPerson;
  return (
    (row.entity === "student" || row.entity === "staff") && Number.isFinite(row.id)
  );
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
      people?: unknown;
    };
    const name = typeof row.name === "string" ? row.name : "";
    const rawPeople = Array.isArray(row.people) ? row.people : [];
    const people: Array<RoleBoardPerson | null> = [];
    for (let i = 0; i < columnCount; i += 1) {
      const person = rawPeople[i];
      people.push(isValidPerson(person) ? person : null);
    }
    return { name, people };
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
