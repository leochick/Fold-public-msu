import { describe, expect, it } from "vitest";
import {
  buildEngagementFunnelData,
  ENGAGEMENT_FUNNEL_LABELS,
  isTablingOnlyAttendance,
} from "../dashboard-engagement";

describe("isTablingOnlyAttendance", () => {
  it("returns true when every attended type is Tabling", () => {
    expect(isTablingOnlyAttendance(["Tabling", "tabling"])).toBe(true);
  });

  it("returns false when mixed with other types", () => {
    expect(isTablingOnlyAttendance(["Tabling", "Weekly"])).toBe(false);
  });

  it("returns false when there are no typed events", () => {
    expect(isTablingOnlyAttendance([])).toBe(false);
    expect(isTablingOnlyAttendance([null, ""])).toBe(false);
  });
});

describe("buildEngagementFunnelData", () => {
  it("classifies tabling-only, active, engaged, newsletter-only, and leaders", () => {
    const data = buildEngagementFunnelData({
      attendances: [
        { studentId: 1, attendanceCount: 2, eventTypes: ["Tabling", "Tabling"] },
        { studentId: 2, attendanceCount: 2, eventTypes: ["Weekly", "Social"] },
        { studentId: 3, attendanceCount: 4, eventTypes: ["Weekly"] },
        { studentId: 4, attendanceCount: 1, eventTypes: ["Tabling"] },
      ],
      newsletterOnlyStudentIds: [10, 11],
      studentLeaderIds: [3, 20],
    });

    expect(data).toEqual([
      { stage: ENGAGEMENT_FUNNEL_LABELS.outreach, count: 4 }, // 2 tabling-only + 2 newsletter
      { stage: ENGAGEMENT_FUNNEL_LABELS.active, count: 1 },
      { stage: ENGAGEMENT_FUNNEL_LABELS.engaged, count: 1 },
      { stage: ENGAGEMENT_FUNNEL_LABELS.student_leader, count: 2 },
    ]);
  });
});
