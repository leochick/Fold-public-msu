import { describe, expect, it } from "vitest";
import {
  deriveClassYearFromGraduationYear,
  springCohortYear,
  springEndsFromAcademicYears,
} from "@/lib/class-year";

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

describe("springCohortYear", () => {
  it("maps fall to the following spring year", () => {
    expect(springCohortYear(utcDate("2026-08-10"))).toBe(2027);
    expect(springCohortYear(utcDate("2026-12-01"))).toBe(2027);
  });

  it("maps winter/spring/summer to that calendar spring year", () => {
    expect(springCohortYear(utcDate("2027-01-15"))).toBe(2027);
    expect(springCohortYear(utcDate("2027-05-01"))).toBe(2027);
    expect(springCohortYear(utcDate("2027-07-01"))).toBe(2027);
  });
});

describe("deriveClassYearFromGraduationYear", () => {
  const springEnds = { 2026: "2026-05-08", 2027: "2027-05-07" };

  it("returns null without a graduation year", () => {
    expect(deriveClassYearFromGraduationYear(null, utcDate("2026-08-10"))).toBeNull();
  });

  it("derives standing in fall from years until spring graduation", () => {
    const today = utcDate("2026-08-10");
    expect(deriveClassYearFromGraduationYear(2027, today, springEnds)).toBe("senior");
    expect(deriveClassYearFromGraduationYear(2028, today, springEnds)).toBe("junior");
    expect(deriveClassYearFromGraduationYear(2029, today, springEnds)).toBe("sophomore");
    expect(deriveClassYearFromGraduationYear(2030, today, springEnds)).toBe("freshman");
  });

  it("keeps seniors through spring finals of their graduation year", () => {
    expect(deriveClassYearFromGraduationYear(2026, utcDate("2026-05-08"), springEnds)).toBe(
      "senior"
    );
  });

  it("sets other after spring graduation", () => {
    expect(deriveClassYearFromGraduationYear(2026, utcDate("2026-05-09"), springEnds)).toBe(
      "other"
    );
    expect(deriveClassYearFromGraduationYear(2026, utcDate("2026-08-10"), springEnds)).toBe(
      "other"
    );
  });

  it("builds spring-end lookup from academic years", () => {
    expect(
      springEndsFromAcademicYears([
        { name: "2025-26", spring: { finalExamsEnd: "2026-05-08" } },
        { name: "2026-27", spring: { finalExamsEnd: null } },
      ])
    ).toEqual({ 2026: "2026-05-08" });
  });
});
