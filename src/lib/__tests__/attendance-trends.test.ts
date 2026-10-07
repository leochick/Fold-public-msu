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
        { name: "Large Group", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 20 },
        { name: "Welcome Social", id: 2, startDate: date("2025-08-28"), type: "Social", totalStudents: 5 },
        { name: "Large Group", id: 3, startDate: date("2026-08-25"), type: "Weekly", totalStudents: 18 },
      ],
      records: [],
    });

    expect(chart.series.map((row) => row.label)).toEqual(["Fall 2025", "Fall 2026"]);
    expect(chart.points[0]?.weekLabel).toBe("Week 0");
    expect(chart.points.at(-1)?.weekLabel).toBe("Week 16");
    expect(chart.points[1]?.["year-1"]).toBe(25);
    expect(chart.points[1]?.["year-2"]).toBe(18);
    expect(chart.points[16]?.["year-2"]).toBeNull();
    expect(chart.eventsBySeries["year-1"]?.[1]?.map((event) => event.name)).toEqual([
      "Large Group",
      "Welcome Social",
    ]);
    expect(chart.eventsBySeries["year-2"]?.[1]?.map((event) => event.name)).toEqual([
      "Large Group",
    ]);
    expect(chart.eventsBySeries["year-1"]?.[0]).toEqual([]);
    expect(chart.eventsBySeries["year-2"]?.[16]).toEqual([]);
  });

  it("skips years with no events in the semester week range", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ name: "Weekly", id: 9, startDate: date("2026-02-01"), type: "Weekly", totalStudents: 10 }],
      records: [],
    });
    expect(chart.series).toEqual([]);
    expect(chart.points).toEqual([]);
  });

  it("uses recorded attendance when totalStudents is missing", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: null }],
      records: [
        { eventId: 1, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 1, studentId: 2, gender: "F", year: "sophomore" },
      ],
    });
    expect(chart.points[1]?.["year-1"]).toBe(2);
  });

  it("filters by event type", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [
        { name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 20 },
        { name: "Retreat", id: 2, startDate: date("2025-08-26"), type: "Retreat", totalStudents: 40 },
      ],
      records: [],
      filters: { eventTypes: ["Weekly"], genders: [], years: [] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(20);
    expect(chart.eventsBySeries["year-1"]?.[1]?.map((event) => event.name)).toEqual(["Weekly"]);
  });

  it("counts matching students instead of totalStudents when gender or year is filtered", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 50 }],
      records: [
        { eventId: 1, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 1, studentId: 2, gender: "M", year: "senior" },
        { eventId: 1, studentId: 3, gender: "F", year: "freshman" },
        { eventId: 1, studentId: 4, gender: null, year: "freshman" },
      ],
      filters: { eventTypes: [], genders: ["M"], years: ["freshman"] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(1);
  });

  it("treats empty filters as all categories", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [{ name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 8 }],
      records: [
        { eventId: 1, studentId: 1, gender: "F", year: "junior" },
        { eventId: 1, studentId: 2, gender: "M", year: "senior" },
      ],
      filters: { eventTypes: [], genders: [], years: [] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(2);
  });

  it("counts each student once when they attend multiple event types in the same week", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [
        { name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 3 },
        { name: "Social", id: 2, startDate: date("2025-08-28"), type: "Social", totalStudents: 2 },
      ],
      records: [
        { eventId: 1, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 1, studentId: 2, gender: "F", year: "sophomore" },
        { eventId: 1, studentId: 3, gender: "M", year: "junior" },
        { eventId: 2, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 2, studentId: 4, gender: "F", year: "senior" },
      ],
      filters: { eventTypes: ["Weekly", "Social"], genders: [], years: [] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(4);
  });

  it("counts a student in each week they attend", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [
        { name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 1 },
        { name: "Social", id: 2, startDate: date("2025-09-02"), type: "Social", totalStudents: 1 },
      ],
      records: [
        { eventId: 1, studentId: 1, gender: "F", year: "junior" },
        { eventId: 2, studentId: 1, gender: "F", year: "junior" },
      ],
    });
    expect(chart.points[1]?.["year-1"]).toBe(1);
    expect(chart.points[2]?.["year-1"]).toBe(1);
  });

  it("still dedupes students when a gender or year filter is on", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025],
      events: [
        { name: "Weekly", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 10 },
        { name: "Social", id: 2, startDate: date("2025-08-28"), type: "Social", totalStudents: 10 },
      ],
      records: [
        { eventId: 1, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 1, studentId: 2, gender: "F", year: "freshman" },
        { eventId: 2, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 2, studentId: 3, gender: "M", year: "senior" },
      ],
      filters: { eventTypes: [], genders: ["M"], years: ["freshman"] },
    });
    expect(chart.points[1]?.["year-1"]).toBe(1);
  });

  it("lists contributing events under each year for the hovered week", () => {
    const chart = buildAttendanceTrendsChart({
      semesters: [fall2025, fall2026],
      events: [
        { name: "Large Group", id: 1, startDate: date("2025-08-26"), type: "Weekly", totalStudents: 2 },
        { name: "Fall Retreat", id: 2, startDate: date("2025-08-27"), type: "Retreat", totalStudents: 10 },
        { name: "Welcome Social", id: 3, startDate: date("2025-08-28"), type: "Social", totalStudents: 1 },
        { name: "Next Year Group", id: 4, startDate: date("2026-08-25"), type: "Weekly", totalStudents: 1 },
      ],
      records: [
        { eventId: 1, studentId: 1, gender: "M", year: "freshman" },
        { eventId: 3, studentId: 2, gender: "F", year: "senior" },
        { eventId: 4, studentId: 1, gender: "M", year: "freshman" },
      ],
      filters: { eventTypes: ["Weekly", "Social"], genders: ["M"], years: [] },
    });

    expect(chart.eventsBySeries["year-1"]?.[1]?.map((event) => event.name)).toEqual([
      "Large Group",
    ]);
    expect(chart.eventsBySeries["year-2"]?.[1]?.map((event) => event.name)).toEqual([
      "Next Year Group",
    ]);
  });
});
