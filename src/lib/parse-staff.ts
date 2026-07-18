function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
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
  };
}
