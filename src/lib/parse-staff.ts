import type { StaffChild } from "../../drizzle/schema";

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAge(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const age = Number(trimmed);
  if (!Number.isFinite(age) || age < 0 || !Number.isInteger(age)) return null;
  return age;
}

function parseGender(raw: string): "M" | "F" | null {
  return raw === "M" || raw === "F" ? raw : null;
}

export function parseStaffChildren(f: FormData): StaffChild[] {
  const names = f.getAll("childName").map((x) => String(x ?? ""));
  const ages = f.getAll("childAge").map((x) => String(x ?? ""));
  const genders = f.getAll("childGender").map((x) => String(x ?? ""));
  const count = Math.max(names.length, ages.length, genders.length);
  const children: StaffChild[] = [];

  for (let i = 0; i < count; i += 1) {
    const name = (names[i] ?? "").trim();
    const age = parseAge(ages[i] ?? "");
    const gender = parseGender(genders[i] ?? "");
    if (!name && age == null && gender == null) continue;
    children.push({ name, age, gender });
  }

  return children;
}

export function parseStaff(f: FormData) {
  const v = (k: string) => {
    const x = f.get(k);
    return x == null || x === "" ? null : String(x);
  };
  const spouseRaw = v("spouseId");
  const spouseNum = spouseRaw == null ? null : Number(spouseRaw);
  return {
    firstName: v("firstName") ?? "",
    lastName: v("lastName"),
    gender: (v("gender") as "M" | "F" | null) ?? null,
    startingDate: parseDate(v("startingDate")),
    endingDate: parseDate(v("endingDate")),
    spouseId: spouseNum != null && Number.isFinite(spouseNum) ? spouseNum : null,
    children: parseStaffChildren(f),
  };
}
