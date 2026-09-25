// Pure functions over students + attendances. No DB, no I/O — composable from any caller.

export type StudentLite = {
  id: number;
  firstName: string;
  lastName: string | null;
  invitedByStudentId: number | null;
};

export type AttendanceLite = {
  studentId: number;
  eventId: number;
  recordedAt: Date;
};

export type InviterTier = "none" | "occasional" | "connector";

export interface PerStudentHealth {
  studentId: number;
  friendsBrought: number;
  friendIds: number[];
  lastInviteAt: Date | null;
  inviterTier: InviterTier;
  /** events attended in the last 30d */
  recentAttendance: number;
  /** events attended in the last 365d */
  yearlyAttendance: number;
  /** lifetime attendance count */
  totalAttendance: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function perStudentHealth(
  students: StudentLite[],
  attendances: AttendanceLite[],
  now: Date = new Date()
): Map<number, PerStudentHealth> {
  // Index: who did each student bring?
  const friendsByInviter = new Map<number, StudentLite[]>();
  for (const s of students) {
    if (s.invitedByStudentId == null) continue;
    const arr = friendsByInviter.get(s.invitedByStudentId) ?? [];
    arr.push(s);
    friendsByInviter.set(s.invitedByStudentId, arr);
  }

  // Index: most-recent attendance per student
  const attendanceCountByStudent = new Map<number, number[]>(); // ms timestamps
  for (const a of attendances) {
    const arr = attendanceCountByStudent.get(a.studentId) ?? [];
    arr.push(a.recordedAt.getTime());
    attendanceCountByStudent.set(a.studentId, arr);
  }
  // Per-friend earliest attendance to compute "lastInviteAt" (when an inviter
  // drove someone's first attendance).
  const earliestAttendance = new Map<number, number>();
  for (const a of attendances) {
    const t = a.recordedAt.getTime();
    const prev = earliestAttendance.get(a.studentId);
    if (prev == null || t < prev) earliestAttendance.set(a.studentId, t);
  }

  const out = new Map<number, PerStudentHealth>();
  for (const s of students) {
    const friends = friendsByInviter.get(s.id) ?? [];
    const friendIds = friends.map((f) => f.id);
    let lastInviteAt: number | null = null;
    for (const f of friends) {
      const e = earliestAttendance.get(f.id);
      if (e != null && (lastInviteAt == null || e > lastInviteAt)) lastInviteAt = e;
    }
    const tier: InviterTier =
      friends.length >= 3 ? "connector" : friends.length >= 1 ? "occasional" : "none";

    const ts = attendanceCountByStudent.get(s.id) ?? [];
    const cutoff30 = now.getTime() - 30 * DAY;
    const cutoff365 = now.getTime() - 365 * DAY;
    const recent = ts.filter((t) => t >= cutoff30).length;
    const yearly = ts.filter((t) => t >= cutoff365).length;

    out.set(s.id, {
      studentId: s.id,
      friendsBrought: friends.length,
      friendIds,
      lastInviteAt: lastInviteAt == null ? null : new Date(lastInviteAt),
      inviterTier: tier,
      recentAttendance: recent,
      yearlyAttendance: yearly,
      totalAttendance: ts.length,
    });
  }
  return out;
}
