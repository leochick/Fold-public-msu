export type StaffDateBounds = {
  startingDate?: Date | string | null;
  endingDate?: Date | string | null;
};

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** True when [startingDate, endingDate] overlaps [from, to]. Null bounds are open-ended. */
export function isStaffActiveInRange(
  staff: StaffDateBounds,
  from: Date,
  to: Date
): boolean {
  const start = toTime(staff.startingDate);
  const end = toTime(staff.endingDate);
  if (start != null && start > to.getTime()) return false;
  if (end != null && end < from.getTime()) return false;
  return true;
}

export function partitionStaffByActiveInRange<T extends StaffDateBounds>(
  staff: T[],
  from: Date,
  to: Date
): { active: T[]; inactive: T[] } {
  const active: T[] = [];
  const inactive: T[] = [];
  for (const member of staff) {
    if (isStaffActiveInRange(member, from, to)) active.push(member);
    else inactive.push(member);
  }
  return { active, inactive };
}

export function formatStaffActiveLabel(
  name: string,
  staff: StaffDateBounds,
  from: Date,
  to: Date
): string {
  const suffix = isStaffActiveInRange(staff, from, to) ? "active" : "inactive";
  return `${name} (${suffix})`;
}
