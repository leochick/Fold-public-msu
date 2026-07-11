import {
  classifyEngagementInRange,
  ENGAGEMENT_STAGE_LABELS,
} from "@/lib/dashboard-engagement";

export type GroupingStudentStatus = "student_leader" | "engaged" | "active" | "outreach";

export const GROUPING_STATUS_LABELS: Record<GroupingStudentStatus, string> = {
  student_leader: "Student Leader",
  engaged: ENGAGEMENT_STAGE_LABELS.engaged,
  active: ENGAGEMENT_STAGE_LABELS.active,
  outreach: "Outreach",
};

export function getStudentStatuses(params: {
  courseMaterial: string[] | null | undefined;
  attendanceCountInRange: number;
  attendedEventTypesInRange: string[];
}): GroupingStudentStatus[] {
  const statuses: GroupingStudentStatus[] = [];

  if (params.courseMaterial?.includes("Student Leader")) {
    statuses.push("student_leader");
  }

  const engagement = classifyEngagementInRange(params.attendanceCountInRange);
  if (engagement === "engaged") {
    statuses.push("engaged");
  } else if (engagement === "active") {
    statuses.push("active");
  }

  const types = params.attendedEventTypesInRange.filter(Boolean);
  const onlyOutreach =
    types.length > 0 && types.every((type) => type.trim().toLowerCase() === "outreach");
  if (onlyOutreach) {
    statuses.push("outreach");
  }

  return statuses;
}

export function getPrimaryStatusBackground(statuses: GroupingStudentStatus[]): string {
  if (statuses.includes("student_leader")) {
    return "bg-emerald-100/80 dark:bg-emerald-900/25 border-emerald-200/60 dark:border-emerald-800/40";
  }
  if (statuses.includes("engaged")) {
    return "bg-amber-100/80 dark:bg-amber-900/25 border-amber-200/60 dark:border-amber-800/40";
  }
  if (statuses.includes("active")) {
    return "bg-white dark:bg-white/5 border-black/5 dark:border-white/10";
  }
  if (statuses.includes("outreach")) {
    return "bg-rose-100/80 dark:bg-rose-900/25 border-rose-200/60 dark:border-rose-800/40";
  }
  return "bg-white dark:bg-white/5 border-black/5 dark:border-white/10";
}
