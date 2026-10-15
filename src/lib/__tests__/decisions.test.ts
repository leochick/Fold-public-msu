import { describe, expect, it } from "vitest";
import {
  filterDecisionStudents,
  isValidDecisionRange,
  parseDecisionKind,
  type DecisionStudent,
} from "@/lib/decisions";

const students: DecisionStudent[] = [
  {
    id: 1,
    firstName: "Jayden",
    lastName: "Hawthorne",
    decisionAt: "2025-09-27",
    decisionType: "salvation",
    notes: "Fall Retreat",
  },
  {
    id: 2,
    firstName: "Regina",
    lastName: "Carbajal",
    decisionAt: "2025-10-09",
    decisionType: "lordship",
    notes: "Course 101",
  },
  {
    id: 3,
    firstName: "Nolan",
    lastName: null,
    decisionAt: "2026-04-16",
    decisionType: "salvation",
    notes: null,
  },
  {
    id: 4,
    firstName: "Sam",
    lastName: "Lee",
    decisionAt: "2025-10-01",
    decisionType: null,
    notes: null,
  },
];

describe("parseDecisionKind", () => {
  it("accepts the three filter values and defaults everything else to both", () => {
    expect(parseDecisionKind("salvation")).toBe("salvation");
    expect(parseDecisionKind("lordship")).toBe("lordship");
    expect(parseDecisionKind("both")).toBe("both");
    expect(parseDecisionKind(undefined)).toBe("both");
    expect(parseDecisionKind("other")).toBe("both");
  });
});

describe("isValidDecisionRange", () => {
  it("requires ISO dates with the start on or before the end", () => {
    expect(isValidDecisionRange("2025-09-01", "2025-12-15")).toBe(true);
    expect(isValidDecisionRange("2025-12-15", "2025-12-15")).toBe(true);
    expect(isValidDecisionRange("2025-12-15", "2025-09-01")).toBe(false);
    expect(isValidDecisionRange("", "2025-09-01")).toBe(false);
  });
});

describe("filterDecisionStudents", () => {
  it("keeps salvation and lordship decisions inside an inclusive range", () => {
    const matches = filterDecisionStudents(students, {
      from: "2025-09-01",
      to: "2025-10-31",
      kind: "both",
    });
    expect(matches.map((student) => student.id)).toEqual([2, 4, 1]);
  });

  it("limits the list to one decision type", () => {
    const salvation = filterDecisionStudents(students, {
      from: "2025-01-01",
      to: "2026-12-31",
      kind: "salvation",
    });
    expect(salvation.map((student) => student.id)).toEqual([3, 1]);

    const lordship = filterDecisionStudents(students, {
      from: "2025-01-01",
      to: "2026-12-31",
      kind: "lordship",
    });
    expect(lordship.map((student) => student.id)).toEqual([2]);
  });

  it("returns nobody when the range is backwards", () => {
    expect(
      filterDecisionStudents(students, {
        from: "2026-01-01",
        to: "2025-01-01",
        kind: "both",
      })
    ).toEqual([]);
  });
});
