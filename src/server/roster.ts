import { db } from "@/lib/db";
import { students } from "../../drizzle/schema";

export type RosterRow = {
  id: number;
  firstName: string;
  lastName: string | null;
  igHandle: string | null;
};

export type RosterRowFull = RosterRow & {
  gender: "M" | "F" | null;
  year: string | null;
};

export async function loadBasicRoster(): Promise<RosterRow[]> {
  return db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      igHandle: students.igHandle,
    })
    .from(students);
}

export async function loadRosterWithStatus() {
  return db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      igHandle: students.igHandle,
      year: students.year,
      memberStatus: students.memberStatus,
      isActive: students.isActive,
    })
    .from(students);
}

export function formatRosterCompact(rows: RosterRow[]) {
  return rows
    .map(
      (r) =>
        `${r.id}|${r.firstName}${r.lastName ? " " + r.lastName : ""}${
          r.igHandle ? " (@" + r.igHandle + ")" : ""
        }`
    )
    .join("\n");
}

export function formatRosterCompactWithStatus(rows: Awaited<ReturnType<typeof loadRosterWithStatus>>) {
  return rows
    .map(
      (r) =>
        `${r.id}|${r.firstName}${r.lastName ? " " + r.lastName : ""}${
          r.igHandle ? " (@" + r.igHandle + ")" : ""
        }|${r.year ?? ""}|${r.memberStatus ?? ""}|${r.isActive ? "active" : "inactive"}`
    )
    .join("\n");
}

export function fuzzyMatchInviter(raw: unknown, roster: RosterRow[]): { id: number; name: string } | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().toLowerCase();
  if (!q) return null;
  const igq = q.replace(/^@/, "");
  let best: { score: number; row: RosterRow } | null = null;
  for (const r of roster) {
    const full = `${r.firstName}${r.lastName ? " " + r.lastName : ""}`.toLowerCase();
    const first = r.firstName.toLowerCase();
    const ig = (r.igHandle ?? "").toLowerCase();
    let score = 0;
    if (full === q) score = 100;
    else if (ig && ig === igq) score = 95;
    else if (first === q) score = 80;
    else if (full.startsWith(q) && q.length >= 3) score = 70;
    else if (first.startsWith(q) && q.length >= 3) score = 60;
    if (score > 0 && (!best || score > best.score)) best = { score, row: r };
  }
  if (!best) return null;
  return {
    id: best.row.id,
    name: `${best.row.firstName}${best.row.lastName ? " " + best.row.lastName : ""}`,
  };
}
