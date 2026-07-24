import { describe, expect, it } from "vitest";
import {
  deriveSummerRange,
  deriveWinterBreakRange,
  findNextAcademicYear,
  shiftIsoDate,
} from "@/lib/academic-calendar-breaks";
import { emptyAcademicSemester } from "../../../drizzle/schema";

describe("shiftIsoDate", () => {
  it("shifts forward and backward by day", () => {
    expect(shiftIsoDate("2025-12-12", 1)).toBe("2025-12-13");
    expect(shiftIsoDate("2026-01-12", -1)).toBe("2026-01-11");
  });
});

describe("deriveWinterBreakRange", () => {
  it("derives range from fall finals end and spring classes begin", () => {
    const fall = {
      ...emptyAcademicSemester(),
      finalExamsEnd: "2025-12-12",
    };
    const spring = {
      ...emptyAcademicSemester(),
      classesBegin: "2026-01-12",
    };
    expect(deriveWinterBreakRange(fall, spring)).toEqual({
      kind: "ready",
      start: "2025-12-13",
      end: "2026-01-11",
      label: expect.stringContaining("2025"),
    });
  });

  it("lists missing fields when data is incomplete", () => {
    const result = deriveWinterBreakRange(emptyAcademicSemester(), emptyAcademicSemester());
    expect(result.kind).toBe("missing");
    if (result.kind === "missing") {
      expect(result.missing).toContain("Fall Semester final exams end date");
      expect(result.missing).toContain("Spring Semester when classes begin");
    }
  });
});

describe("deriveSummerRange", () => {
  it("derives range from spring finals end and next fall move-in", () => {
    const spring = {
      ...emptyAcademicSemester(),
      finalExamsEnd: "2026-05-08",
    };
    const nextFall = {
      ...emptyAcademicSemester(),
      newStudentsMoveIn: "2026-08-20",
    };
    expect(deriveSummerRange(spring, nextFall, "2026-27")).toEqual({
      kind: "ready",
      start: "2026-05-09",
      end: "2026-08-19",
      label: expect.stringContaining("2026"),
    });
  });

  it("asks for the next academic year when missing", () => {
    const spring = {
      ...emptyAcademicSemester(),
      finalExamsEnd: "2026-05-08",
    };
    const result = deriveSummerRange(spring, null, null);
    expect(result.kind).toBe("missing");
    if (result.kind === "missing") {
      expect(result.missing.some((item) => item.includes("next academic year"))).toBe(true);
    }
  });
});

describe("findNextAcademicYear", () => {
  it("matches by parsed year span", () => {
    const years = [
      { id: 1, name: "2025-26" },
      { id: 2, name: "2026-27" },
      { id: 3, name: "2024-25" },
    ];
    expect(findNextAcademicYear(years, years[0])?.id).toBe(2);
  });
});
