/** Minimum event attendances in the selected range to count as active. */
export const ACTIVE_MIN_ATTENDANCES = 1;

/** Minimum event attendances in the selected range to count as engaged. */
export const ENGAGED_MIN_ATTENDANCES = 3;

export type RangeEngagementStage = "active" | "engaged";

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
