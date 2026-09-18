import { describe, expect, it } from "vitest";
import { parseDashboardDateStart } from "@/lib/dashboard-date-range";
import {
  buildAttendanceTrendsChart,
  lastWeekNumberForSemester,
  parseAttendanceTrendsSeason,
} from "@/lib/attendance-trends";
import { emptyAcademicSemester } from "../../../drizzle/schema";

function date(iso: string) {
  return parseDashboardDateStart(iso)!;
}

describe("parseAttendanceTrendsSeason", () => {
  it("defaults to fall and only accepts spring as the other value", () => {
    expect(parseAttendanceTrendsSeason(undefined)).toBe("fall");
    expect(parseAttendanceTrendsSeason("fall")).toBe("fall");
    expect(parseAttendanceTrendsSeason("spring")).toBe("spring");
    expect(parseAttendanceTrendsSeason("winter")).toBe("fall");
  });
});

describe("lastWeekNumberForSemester", () => {
  const classesBegin = date("2025-08-25");

  it("uses finals end when present", () => {
    expect(
      lastWeekNumberForSemester(classesBegin, {
        classesEnd: "2025-12-05",
        finalExamsEnd: "2025-12-12",
      })
    ).toBe(16);
  });

  it("falls back to classes end", () => {
    expect(
      lastWeekNumberForSemester(classesBegin, {
        classesEnd: "2025-11-28",
        finalExamsEnd: null,
      })
    ).toBe(14);
  });

  it("falls back to the semester week grid max when no end date exists", () => {
    expect(
      lastWeekNumberForSemester(classesBegin, {
        classesEnd: null,
        finalExamsEnd: null,
      })
    ).toBe(16);
  });
});

describe("buildAttendanceTrendsChart", () => {
  const fall2025 = {
    academicYearId: 1,
    yearName: "2025-26",
    season: "fall" as const,
    semester: {
      ...emptyAcademicSemester(),
      classesBegin: "2025-08-25",
      classesEnd: "2025-12-05",
      finalExamsEnd: "2025-12-12",
    },
  };
  const fall2026 = {
    academicYearId: 2,
    yearName: "2026-27",
    season: "fall" as const,
    semester: {
      ...emptyAcademicSemester(),
      classesBegin: "2026-08-24",
      classesEnd: "2026-11-25",
      finalExamsEnd: "2026-11-25",
    },
  };

  it("builds one line per year with events and sums attendance by week", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025, fall2026],
      events: [
        { id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 20 },
        { id: 2, startDate: date("2025-08-28"), type: "Social", totalStudents: 5 },
        { id: 3, startDate: date("2026-08-25"), type: "Weekly", totalStudents: 18 },
      ],
      records: [],
    });

    expect(chart.series.map((row) => row.label)).toEqual(["Fall 2025", "Fall 2026"]);
    expect(chart.points[0]?.weekLabel).toBe("Week 0");
    expect(chart.points.at(-1)?.weekLabel).toBe("Week 16");
    expect(chart.points[1]?.["year-1"]).toBe(25);
    expect(chart.points[1]?.["year-2"]).toBe(18);
    expect(chart.points[16]?.["year-2"]).toBeNull();
  });

  it("skips years with no events in the semester week range", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ id: 9, startDate: date("2026-02-01"), type: "Weekly", totalStudents: 10 }],
      records: [],
    });
    expect(chart.series).toEqual([]);
    expect(chart.points).toEqual([]);
  });

  it("uses recorded attendance when totalStudents is missing", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: null }],
      records: [
        { eventId: 1, gender: "M", year: "freshman" },
        { eventId: 1, gender: "F", year: "sophomore" },
      ],
    });
    expect(chart.points[1]?.["year-1"]).toBe(2);
  });

  it("filters by event type", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [
        { id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 20 },
        { id: 2, startDate: date("2025-08-26"), type: "Retreat", totalStudents: 40 },
      ],
      records: [],
      filters: { eventTypes: ["Weekly"], genders: [], years: [] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(20);
  });

  it("counts matching students instead of totalStudents when gender or year is filtered", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 50 }],
      records: [
        { eventId: 1, gender: "M", year: "freshman" },
        { eventId: 1, gender: "M", year: "senior" },
        { eventId: 1, gender: "F", year: "freshman" },
        { eventId: 1, gender: null, year: "freshman" },
      ],
      filters: { eventTypes: [], genders: ["M"], years: ["freshman"] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(1);
  });

  it("treats empty filters as all categories", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 8 }],
      records: [{ eventId: 1, gender: "F", year: "junior" }],
      filters: { eventTypes: [], genders: [], years: [] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(8);
  });
});
