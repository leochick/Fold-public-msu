import { describe, expect, it } from "vitest";
import { getPrimaryStatusBackground, getStudentStatuses } from "@/lib/grouping-status";

describe("getStudentStatuses", () => {
  it("marks student leaders from course material", () => {
    const statuses = getStudentStatuses({
      courseMaterial: ["Student Leader"],
      attendanceCountInRange: 1,
      attendedEventTypesInRange: ["Weekly"],
    });
    expect(statuses).toContain("student_leader");
    expect(statuses).toContain("active");
  });

  it("marks engaged students with 3+ attendances", () => {
    const statuses = getStudentStatuses({
      courseMaterial: [],
      attendanceCountInRange: 3,
      attendedEventTypesInRange: ["Weekly"],
    });
    expect(statuses).toContain("engaged");
    expect(statuses).not.toContain("active");
  });

  it("marks outreach when only tabling events were attended", () => {
    const statuses = getStudentStatuses({
      courseMaterial: [],
      attendanceCountInRange: 1,
      attendedEventTypesInRange: ["Tabling"],
    });
    expect(statuses).toContain("outreach");
    expect(statuses).toContain("active");
  });

  it("marks outreach for newsletter-only students", () => {
    const statuses = getStudentStatuses({
      courseMaterial: [],
      attendanceCountInRange: 0,
      attendedEventTypesInRange: [],
      newsletter: true,
    });
    expect(statuses).toContain("outreach");
    expect(statuses).not.toContain("active");
  });

  it("does not mark outreach for the old Outreach event type alone", () => {
    const statuses = getStudentStatuses({
      courseMaterial: [],
      attendanceCountInRange: 1,
      attendedEventTypesInRange: ["Outreach"],
    });
    expect(statuses).not.toContain("outreach");
    expect(statuses).toContain("active");
  });

  it("does not mark outreach when other event types were attended with tabling", () => {
    const statuses = getStudentStatuses({
      courseMaterial: [],
      attendanceCountInRange: 2,
      attendedEventTypesInRange: ["Tabling", "Weekly"],
    });
    expect(statuses).not.toContain("outreach");
  });
});

describe("getPrimaryStatusBackground", () => {
  it("prioritizes student leader over engaged", () => {
    const className = getPrimaryStatusBackground(["student_leader", "engaged"]);
    expect(className).toContain("emerald");
  });
});
