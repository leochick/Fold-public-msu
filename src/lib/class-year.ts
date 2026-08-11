import { parseDashboardDateEnd } from "@/lib/dashboard-date-range";

export type DerivedClassYear = "freshman" | "sophomore" | "junior" | "senior" | "other";

/** Default spring end when academic-calendar finals dates are unavailable (YYYY-MM-DD). */
export function defaultSpringEndIso(graduationYear: number): string {
  return `${graduationYear}-05-31`;
}

/**
 * Spring cohort year for the academic year containing `today`.
 * Fall (Aug–Dec) belongs to the spring that follows; Jan–Jul belongs to that calendar spring.
 */
export function springCohortYear(today: Date = new Date()): number {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1; // 1–12
  return month >= 8 ? year + 1 : year;
}

export function isPastSpringEnd(
  graduationYear: number,
  today: Date = new Date(),
  springEndByYear?: Readonly<Record<number, string>>
): boolean {
  const endIso = springEndByYear?.[graduationYear] ?? defaultSpringEndIso(graduationYear);
  const end = parseDashboardDateEnd(endIso);
  if (!end) return false;
  return today.getTime() > end.getTime();
}

/**
 * Derive class Year from Graduation Year.
 * Seniors graduate at the end of Spring of the graduation year; afterward Year is "other".
 */
export function deriveClassYearFromGraduationYear(
  graduationYear: number | null | undefined,
  today: Date = new Date(),
  springEndByYear?: Readonly<Record<number, string>>
): DerivedClassYear | null {
  if (graduationYear == null || !Number.isFinite(graduationYear)) return null;
  const g = Math.trunc(graduationYear);
  if (g < 2000 || g > 2100) return null;

  if (isPastSpringEnd(g, today, springEndByYear)) return "other";

  const remaining = g - springCohortYear(today);
  if (remaining <= 0) return "senior";
  if (remaining === 1) return "junior";
  if (remaining === 2) return "sophomore";
  return "freshman";
}

export function classYearLabel(year: DerivedClassYear | null | undefined): string {
  switch (year) {
    case "freshman":
      return "Freshman";
    case "sophomore":
      return "Sophomore";
    case "junior":
      return "Junior";
    case "senior":
      return "Senior";
    case "other":
      return "Other";
    default:
      return "—";
  }
}

/** Build spring-end lookup from academic years: spring calendar year → finals end ISO. */
export function springEndsFromAcademicYears(
  years: Array<{
    name: string;
    spring: { finalExamsEnd?: string | null };
  }>
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const year of years) {
    const end = year.spring.finalExamsEnd?.trim();
    if (!end) continue;
    const springYear = Number(end.slice(0, 4));
    if (Number.isFinite(springYear)) out[springYear] = end;
  }
  return out;
}
