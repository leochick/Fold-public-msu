/** Minimum event attendances in the selected range to count as active. */
export const ACTIVE_MIN_ATTENDANCES = 1;

/** Minimum event attendances in the selected range to count as engaged. */
export const ENGAGED_MIN_ATTENDANCES = 3;

export type RangeEngagementStage = "active" | "engaged";

export const ENGAGEMENT_STAGE_LABELS: Record<RangeEngagementStage, string> = {
  active: "Active (1-2 events)",
  engaged: "Engaged (3+ events)",
};

export type EngagementFunnelStage =
  | "outreach"
  | "active"
  | "engaged"
  | "student_leader";

export const ENGAGEMENT_FUNNEL_LABELS: Record<EngagementFunnelStage, string> = {
  outreach: "Outreach (tabling or newsletter)",
  active: ENGAGEMENT_STAGE_LABELS.active,
  engaged: ENGAGEMENT_STAGE_LABELS.engaged,
  student_leader: "Student Leaders",
};

const TABLING_TYPE = "tabling";

export function classifyEngagementInRange(
  attendanceCount: number
): RangeEngagementStage | null {
  if (attendanceCount >= ENGAGED_MIN_ATTENDANCES) return "engaged";
  if (attendanceCount >= ACTIVE_MIN_ATTENDANCES) return "active";
  return null;
}

export function isActiveOrEngagedInRange(attendanceCount: number): boolean {
  return classifyEngagementInRange(attendanceCount) !== null;
}

/** True when the student attended at least one event and every event type is Tabling. */
export function isTablingOnlyAttendance(
  eventTypes: Array<string | null | undefined>
): boolean {
  const types = eventTypes.map((type) => (type ?? "").trim()).filter(Boolean);
  return types.length > 0 && types.every((type) => type.toLowerCase() === TABLING_TYPE);
}

export type StudentAttendanceInRange = {
  studentId: number;
  attendanceCount: number;
  eventTypes: Array<string | null | undefined>;
};

export function buildEngagementFunnelData(params: {
  attendances: StudentAttendanceInRange[];
  /** Newsletter subscribers with no attendance in the selected range. */
  newsletterOnlyStudentIds: number[];
  /** Students in scope who have Student Leader on course material. */
  studentLeaderIds: number[];
}): Array<{ stage: string; count: number }> {
  let outreach = 0;
  let active = 0;
  let engaged = 0;

  for (const row of params.attendances) {
    if (isTablingOnlyAttendance(row.eventTypes)) {
      outreach += 1;
      continue;
    }
    const stage = classifyEngagementInRange(row.attendanceCount);
    if (stage === "active") active += 1;
    else if (stage === "engaged") engaged += 1;
  }

  outreach += new Set(params.newsletterOnlyStudentIds).size;

  return [
    { stage: ENGAGEMENT_FUNNEL_LABELS.outreach, count: outreach },
    { stage: ENGAGEMENT_FUNNEL_LABELS.active, count: active },
    { stage: ENGAGEMENT_FUNNEL_LABELS.engaged, count: engaged },
    {
      stage: ENGAGEMENT_FUNNEL_LABELS.student_leader,
      count: new Set(params.studentLeaderIds).size,
    },
  ];
}
