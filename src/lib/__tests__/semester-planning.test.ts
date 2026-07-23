import { describe, expect, it } from "vitest";
import { parseDashboardDateStart } from "@/lib/dashboard-date-range";
import {
  buildSemesterColumn,
  getWeek1Start,
  getWeekEnd,
  getWeekStart,
  parseAcademicYearName,
  semesterLabel,
  specialsForWeek,
  startOfWeekSunday,
  weekNumberForDate,
} from "@/lib/semester-planning";
import { emptyAcademicSemester } from "../../../drizzle/schema";

describe("parseAcademicYearName", () => {
  it("parses YYYY-YY", () => {
    expect(parseAcademicYearName("2025-26")).toEqual({ startYear: 2025, endYear: 2026 });
  });

  it("parses YYYY-YYYY", () => {
    expect(parseAcademicYearName("2025-2026")).toEqual({ startYear: 2025, endYear: 2026 });
  });

  it("handles century rollover like 1999-00", () => {
    expect(parseAcademicYearName("1999-00")).toEqual({ startYear: 1999, endYear: 2000 });
  });
});

describe("semesterLabel", () => {
  it("labels fall and spring from academic year name", () => {
    expect(semesterLabel("fall", "2025-26")).toBe("Fall 2025");
    expect(semesterLabel("spring", "2025-26")).toBe("Spring 2026");
  });
});

describe("week boundaries", () => {
  it("Week 1 starts on the Sunday of the classes-begin week", () => {
    // Monday Aug 25, 2025 UTC
    const classesBegin = parseDashboardDateStart("2025-08-25")!;
    expect(startOfWeekSunday(classesBegin).toISOString().slice(0, 10)).toBe("2025-08-24");
    expect(getWeek1Start(classesBegin).toISOString().slice(0, 10)).toBe("2025-08-24");
  });

  it("Week 0 is the preceding Sunday–Saturday", () => {
    const classesBegin = parseDashboardDateStart("2025-08-25")!;
    expect(getWeekStart(classesBegin, 0).toISOString().slice(0, 10)).toBe("2025-08-17");
    expect(getWeekEnd(classesBegin, 0).toISOString().slice(0, 10)).toBe("2025-08-23");
  });

  it("maps dates into week numbers 0–16", () => {
    const classesBegin = parseDashboardDateStart("2025-08-25")!;
    expect(weekNumberForDate(classesBegin, parseDashboardDateStart("2025-08-20")!)).toBe(0);
    expect(weekNumberForDate(classesBegin, parseDashboardDateStart("2025-08-25")!)).toBe(1);
    expect(weekNumberForDate(classesBegin, parseDashboardDateStart("2025-08-31")!)).toBe(2);
  });
});

describe("specialsForWeek", () => {
  it("includes overlapping holidays and finals", () => {
    const classesBegin = parseDashboardDateStart("2025-08-25")!;
    const semester = {
      ...emptyAcademicSemester(),
      classesBegin: "2025-08-25",
      finalExamsStart: "2025-12-08",
      finalExamsEnd: "2025-12-12",
      holidays: [
        { name: "Thanksgiving Break", startDate: "2025-11-27", endDate: "2025-11-28" },
      ],
    };

    const thanksgivingWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-11-27")!)!;
    const finalsWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-12-08")!)!;

    expect(specialsForWeek(semester, classesBegin, thanksgivingWeek).some((label) =>
      label.includes("Thanksgiving")
    )).toBe(true);
    expect(specialsForWeek(semester, classesBegin, finalsWeek).some((label) =>
      label.includes("Final Exams")
    )).toBe(true);
    expect(specialsForWeek(semester, classesBegin, 1)).toEqual([]);
  });
});

describe("buildSemesterColumn", () => {
  it("buckets events into weeks and skips semesters without classesBegin", () => {
    expect(
      buildSemesterColumn({
        academicYearId: 1,
        yearName: "2025-26",
        season: "fall",
        semester: emptyAcademicSemester(),
        events: [],
      })
    ).toBeNull();

    const column = buildSemesterColumn({
      academicYearId: 1,
      yearName: "2025-26",
      season: "fall",
      semester: {
        ...emptyAcademicSemester(),
        classesBegin: "2025-08-25",
      },
      events: [
        {
          id: 10,
          name: "Welcome BBQ",
          startDate: parseDashboardDateStart("2025-08-26")!,
          notes: "Bring sides",
        },
        {
          id: 11,
          name: "Core Meeting",
          startDate: parseDashboardDateStart("2025-08-28")!,
          notes: null,
        },
      ],
    });

    expect(column?.label).toBe("Fall 2025");
    expect(column?.weeks).toHaveLength(17);
    expect(column?.weeks[1]?.events.map((event) => event.name)).toEqual([
      "Welcome BBQ",
      "Core Meeting",
    ]);
  });
});
