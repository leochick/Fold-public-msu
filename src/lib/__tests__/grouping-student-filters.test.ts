import { describe, expect, it } from "vitest";
import { studentMatchesFilters } from "@/lib/grouping-student-filters";

describe("studentMatchesFilters", () => {
  const base = {
    year: "freshman" as const,
    courseMaterial: ["Course 101"],
    newsletter: true,
    groupme: false,
  };

  it("passes when no filters are selected", () => {
    expect(
      studentMatchesFilters(base, { years: [], experiences: [], communications: [] })
    ).toBe(true);
  });

  it("filters by year", () => {
    expect(studentMatchesFilters(base, { years: ["freshman"], experiences: [], communications: [] })).toBe(
      true
    );
    expect(studentMatchesFilters(base, { years: ["senior"], experiences: [], communications: [] })).toBe(
      false
    );
  });

  it("filters by experience", () => {
    expect(
      studentMatchesFilters(base, { years: [], experiences: ["Course 101"], communications: [] })
    ).toBe(true);
    expect(studentMatchesFilters(base, { years: [], experiences: ["ERT"], communications: [] })).toBe(
      false
    );
  });

  it("filters by communication", () => {
    expect(
      studentMatchesFilters(base, { years: [], experiences: [], communications: ["newsletter"] })
    ).toBe(true);
    expect(
      studentMatchesFilters(base, { years: [], experiences: [], communications: ["groupme"] })
    ).toBe(false);
  });
});
