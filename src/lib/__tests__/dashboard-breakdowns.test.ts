import { describe, expect, it } from "vitest";
import {
  breakdownTooltipColumns,
  breakdownTooltipSize,
  buildEventTypeBreakdown,
  buildGenderBreakdown,
  buildYearBreakdown,
  formatBreakdownStudentName,
} from "../dashboard-breakdowns";

describe("formatBreakdownStudentName", () => {
  it("joins first and last name", () => {
    expect(formatBreakdownStudentName("Ada", "Lovelace", 1)).toBe("Ada Lovelace");
  });

  it("falls back to a stable student id label", () => {
    expect(formatBreakdownStudentName("  ", null, 9)).toBe("Student 9");
  });
});

describe("buildYearBreakdown", () => {
  it("groups named students and skips missing years", () => {
    const data = buildYearBreakdown([
      { id: 2, name: "Bea", year: "junior" },
      { id: 1, name: "Ada", year: "freshman" },
      { id: 3, name: "Cara", year: "freshman" },
      { id: 4, name: "Drew", year: null },
    ]);

    expect(data.map((row) => row.name)).toEqual(["freshman", "junior"]);
    expect(data[0]).toEqual({
      name: "freshman",
      value: 2,
      students: [
        { id: 1, name: "Ada" },
        { id: 3, name: "Cara" },
      ],
    });
  });
});

describe("buildGenderBreakdown", () => {
  it("maps M/F labels and sorts students by name", () => {
    const data = buildGenderBreakdown([
      { id: 2, name: "Zed", gender: "M" },
      { id: 1, name: "Amy", gender: "F" },
      { id: 3, name: "Ben", gender: "M" },
      { id: 4, name: "Skip", gender: null },
    ]);

    expect(data).toEqual([
      {
        name: "Male",
        value: 2,
        students: [
          { id: 3, name: "Ben" },
          { id: 2, name: "Zed" },
        ],
      },
      {
        name: "Female",
        value: 1,
        students: [{ id: 1, name: "Amy" }],
      },
    ]);
  });
});

describe("breakdownTooltipColumns", () => {
  it("keeps short lists in one column", () => {
    expect(breakdownTooltipColumns(0)).toBe(1);
    expect(breakdownTooltipColumns(12)).toBe(1);
  });

  it("adds columns instead of a tall scrolling list", () => {
    expect(breakdownTooltipColumns(13)).toBe(2);
    expect(breakdownTooltipColumns(24)).toBe(2);
    expect(breakdownTooltipColumns(25)).toBe(3);
    expect(breakdownTooltipColumns(100, 6)).toBe(6);
  });
});

describe("breakdownTooltipSize", () => {
  it("widens with column count", () => {
    expect(breakdownTooltipSize(12).columns).toBe(1);
    expect(breakdownTooltipSize(13).width).toBeGreaterThan(breakdownTooltipSize(12).width);
    expect(breakdownTooltipSize(13).height).toBeLessThan(breakdownTooltipSize(13).width * 2);
  });
});

describe("buildEventTypeBreakdown", () => {
  it("keeps event counts and lists unique attendees per type", () => {
    const studentsById = new Map([
      [1, { id: 1, name: "Ada" }],
      [2, { id: 2, name: "Bea" }],
    ]);

    const data = buildEventTypeBreakdown(
      [
        { type: "Weekly", count: 5 },
        { type: "Retreat", count: 1 },
        { type: null, count: 2 },
      ],
      [
        { studentId: 1, eventType: "Weekly" },
        { studentId: 1, eventType: "Weekly" },
        { studentId: 2, eventType: "Weekly" },
        { studentId: 2, eventType: "Retreat" },
        { studentId: 1, eventType: null },
      ],
      studentsById
    );

    expect(data).toEqual([
      {
        name: "Weekly",
        value: 5,
        students: [
          { id: 1, name: "Ada" },
          { id: 2, name: "Bea" },
        ],
      },
      {
        name: "Retreat",
        value: 1,
        students: [{ id: 2, name: "Bea" }],
      },
    ]);
  });
});
