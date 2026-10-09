import { describe, expect, it } from "vitest";
import { parseDashboardDateStart } from "@/lib/dashboard-date-range";
import {
  buildSemesterColumn,
  eventAttendanceTotal,
  formatSemesterPlanningDateLabel,
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
        { name: "Labor Day", startDate: "2025-09-01", endDate: null },
        { name: "Thanksgiving Break", startDate: "2025-11-27", endDate: "2025-11-28" },
      ],
      footballGames: [
        { name: "MSU vs. UCLA", date: "2025-09-06", startTime: "15:30", venue: "home" },
        { name: "MSU vs. Iowa", date: "2025-10-04", startTime: "12:00", venue: "away" },
      ],
    };

    const laborDayWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-09-01")!)!;
    const uclaWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-09-06")!)!;
    const thanksgivingWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-11-27")!)!;
    const finalsWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-12-08")!)!;

    expect(specialsForWeek(semester, classesBegin, laborDayWeek)).toContain(
      "Labor Day (Mon - Sep 1, 2025)"
    );
    expect(specialsForWeek(semester, classesBegin, uclaWeek)).toContain(
      "MSU vs. UCLA (Home) (Sat - Sep 6, 2025)"
    );
    expect(specialsForWeek(semester, classesBegin, thanksgivingWeek)).toContain(
      "Thanksgiving Break (Thu - Nov 27, 2025 – Fri - Nov 28, 2025)"
    );
    const iowaWeek = weekNumberForDate(classesBegin, parseDashboardDateStart("2025-10-04")!)!;
    expect(specialsForWeek(semester, classesBegin, iowaWeek)).toContain(
      "MSU vs. Iowa (Away) (Sat - Oct 4, 2025)"
    );
    expect(specialsForWeek(semester, classesBegin, finalsWeek)).toContain(
      "Final Exams (Mon - Dec 8, 2025 – Fri - Dec 12, 2025)"
    );
    expect(specialsForWeek(semester, classesBegin, 1)).toEqual([]);
  });
});

describe("eventAttendanceTotal", () => {
  it("uses the recorded total when present, otherwise associated students", () => {
    expect(eventAttendanceTotal({ totalStudents: 10, attendanceCount: 4 })).toBe(10);
    expect(eventAttendanceTotal({ totalStudents: 0, attendanceCount: 4 })).toBe(0);
    expect(eventAttendanceTotal({ totalStudents: null, attendanceCount: 7 })).toBe(7);
  });
});

describe("formatSemesterPlanningDateLabel", () => {
  it("prefixes the weekday", () => {
    expect(formatSemesterPlanningDateLabel(parseDashboardDateStart("2025-08-29")!)).toBe(
      "Fri - Aug 29, 2025"
    );
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
          totalStudents: null,
          attendanceCount: 12,
        },
        {
          id: 11,
          name: "Anchor Friday",
          startDate: parseDashboardDateStart("2025-08-29")!,
          notes: null,
          totalStudents: 10,
          attendanceCount: 3,
        },
      ],
    });

    expect(column?.label).toBe("Fall 2025");
    expect(column?.weeks).toHaveLength(17);
    expect(
      column?.weeks[1]?.events.map((event) => ({
        label: `${event.name} (${event.attendance})`,
        dateLabel: event.dateLabel,
      }))
    ).toEqual([
      { label: "Welcome BBQ (12)", dateLabel: "Tue - Aug 26, 2025" },
      { label: "Anchor Friday (10)", dateLabel: "Fri - Aug 29, 2025" },
    ]);
  });
});
