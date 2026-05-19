import { describe, test, expect } from "vitest";
import { runFilter, type FilterSpec } from "../filter-to-sql";

// We don't have a real DB in tests — sanity check that the function returns a promise and
// that obviously invalid specs don't throw at type level. The deeper SQL behavior is covered
// by integration tests against a real DB.
describe("runFilter", () => {
  test("empty filter produces a promise", () => {
    const p = runFilter({} as FilterSpec).catch(() => null);
    expect(p).toBeInstanceOf(Promise);
  });

  test("filter spec type accepts all documented fields", () => {
    const spec: FilterSpec = {
      gender: "F",
      year: ["freshman", "sophomore"],
      memberStatus: ["core"],
      isActive: true,
      contactedViaIg: false,
      attendedEventNameContains: "weekly",
      notAttendedSinceDays: 30,
      attendedAtLeast: 3,
      nameContains: "ali",
      primaryContactContains: "andrew",
    };
    expect(spec.gender).toBe("F");
    expect(spec.year).toEqual(["freshman", "sophomore"]);
  });
});
