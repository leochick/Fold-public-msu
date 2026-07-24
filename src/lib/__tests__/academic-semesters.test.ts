import { describe, expect, it } from "vitest";
import {
  deriveFallSemesterRange,
  deriveSpringSemesterRange,
  formatAcademicSemesterName,
  listComputableAcademicSemesters,
} from "@/lib/academic-semesters";
import { emptyAcademicSemester } from "../../../drizzle/schema";

describe("formatAcademicSemesterName", () => {
  it("formats names from academic year spans", () => {
    expect(formatAcademicSemesterName("fall", "2025-26")).toBe("2025 Fall Semester");
    expect(formatAcademicSemesterName("winter", "2025-26")).toBe("2025-26 Winter Break");
    expect(formatAcademicSemesterName("spring", "2025-26")).toBe("2026 Spring Semester");
    expect(formatAcademicSemesterName("summer", "2025-26")).toBe("2026 Summer");
  });
});

describe("deriveFallSemesterRange / deriveSpringSemesterRange", () => {
  it("uses move-in through finals for fall", () => {
    expect(
      deriveFallSemesterRange({
        ...emptyAcademicSemester(),
        newStudentsMoveIn: "2025-08-20",
        finalExamsEnd: "2025-12-12",
      })
    ).toMatchObject({ from: "2025-08-20", to: "2025-12-12" });
  });

  it("uses classes begin through finals for spring", () => {
    expect(
      deriveSpringSemesterRange({
        ...emptyAcademicSemester(),
        classesBegin: "2026-01-12",
        finalExamsEnd: "2026-05-08",
      })
    ).toMatchObject({ from: "2026-01-12", to: "2026-05-08" });
  });
});

describe("listComputableAcademicSemesters", () => {
  it("returns only seasons with complete date ranges, in chronological order", () => {
    const years = [
      {
        id: 1,
        name: "2025-26",
        fall: {
          ...emptyAcademicSemester(),
          newStudentsMoveIn: "2025-08-20",
          finalExamsEnd: "2025-12-12",
        },
        spring: {
          ...emptyAcademicSemester(),
          classesBegin: "2026-01-12",
          finalExamsEnd: "2026-05-08",
        },
      },
      {
        id: 2,
        name: "2026-27",
        fall: {
          ...emptyAcademicSemester(),
          newStudentsMoveIn: "2026-08-20",
          finalExamsEnd: "2026-12-11",
        },
        spring: emptyAcademicSemester(),
      },
    ];

    const semesters = listComputableAcademicSemesters(years);
    expect(semesters.map((s) => s.name)).toEqual([
      "2025 Fall Semester",
      "2025-26 Winter Break",
      "2026 Spring Semester",
      "2026 Summer",
      "2026 Fall Semester",
    ]);
  });

  it("omits seasons that lack required dates", () => {
    const semesters = listComputableAcademicSemesters([
      {
        id: 1,
        name: "2025-26",
        fall: {
          ...emptyAcademicSemester(),
          newStudentsMoveIn: "2025-08-20",
          // missing finals end
        },
        spring: emptyAcademicSemester(),
      },
    ]);
    expect(semesters).toEqual([]);
  });
});
