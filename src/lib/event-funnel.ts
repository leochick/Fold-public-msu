export type EventFunnelSemester = {
  name: string;
  fromMs: number;
  toMs: number;
};

export type EventFunnelEvent = {
  id: number;
  name: string;
  startMs: number;
};

export type EventFunnelAttendance = {
  studentId: number;
  eventId: number;
};

export type EventFunnelFirstEvent = {
  studentId: number;
  eventId: number;
  name: string;
  startMs: number;
};

export type EventFunnelStudent = {
  id: number;
  name: string;
};

export type EventFunnelSource = {
  key: string;
  eventId: number;
  label: string;
  count: number;
  returning: boolean;
  newStudents: boolean;
  startMs: number;
  students: EventFunnelStudent[];
};

export type EventFunnelOption = {
  id: number;
  name: string;
  dateLabel: string;
};

export type EventFunnelBreakdown = {
  total: number;
  sources: EventFunnelSource[];
};

export type EventFunnelPayload = {
  events: EventFunnelOption[];
  byEventId: Record<string, EventFunnelBreakdown>;
};

export const PREVIOUS_SEMESTER_FALLBACK = "previous semester";
export const NEW_STUDENTS_LABEL = "New Students";

export function pickFirstEvents(
  rows: EventFunnelFirstEvent[]
): Map<number, EventFunnelFirstEvent> {
  const firstByStudent = new Map<number, EventFunnelFirstEvent>();
  for (const row of rows) {
    const prev = firstByStudent.get(row.studentId);
    if (
      !prev ||
      row.startMs < prev.startMs ||
      (row.startMs === prev.startMs && row.eventId < prev.eventId)
    ) {
      firstByStudent.set(row.studentId, row);
    }
  }
  return firstByStudent;
}

export function semesterNameForDate(
  startMs: number,
  semesters: EventFunnelSemester[]
): string | null {
  for (const semester of semesters) {
    if (startMs >= semester.fromMs && startMs <= semester.toMs) {
      return semester.name;
    }
  }
  return null;
}

export function isInRange(startMs: number, fromMs: number, toMs: number): boolean {
  return startMs >= fromMs && startMs <= toMs;
}

export function sourceLabel(params: {
  eventName: string;
  returning: boolean;
  newStudents?: boolean;
  semesterName: string | null;
}): string {
  if (params.newStudents) return NEW_STUDENTS_LABEL;
  if (!params.returning) return params.eventName;
  return `${params.eventName} (${params.semesterName ?? PREVIOUS_SEMESTER_FALLBACK})`;
}

function resolveStudentName(studentId: number, studentNames?: Map<number, string>): string {
  const name = studentNames?.get(studentId)?.trim();
  return name || `Student ${studentId}`;
}

function sortStudents(students: EventFunnelStudent[]): EventFunnelStudent[] {
  return [...students].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.id - b.id;
  });
}

export function buildSourcesForEvent(
  attendeeIds: number[],
  firstByStudent: Map<number, EventFunnelFirstEvent>,
  current: { fromMs: number; toMs: number },
  semesters: EventFunnelSemester[],
  selectedEventId?: number,
  studentNames?: Map<number, string>
): EventFunnelSource[] {
  const byKey = new Map<string, EventFunnelSource>();

  for (const studentId of attendeeIds) {
    const first = firstByStudent.get(studentId);
    if (!first) continue;

    const newStudents = selectedEventId != null && first.eventId === selectedEventId;
    const returning = !newStudents && !isInRange(first.startMs, current.fromMs, current.toMs);
    const semesterName = returning ? semesterNameForDate(first.startMs, semesters) : null;
    const key = newStudents ? "new" : `${returning ? "r" : "c"}:${first.eventId}`;
    const student = { id: studentId, name: resolveStudentName(studentId, studentNames) };
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.students.some((row) => row.id === studentId)) {
        existing.students.push(student);
        existing.count = existing.students.length;
      }
      continue;
    }

    byKey.set(key, {
      key,
      eventId: first.eventId,
      label: sourceLabel({ eventName: first.name, returning, newStudents, semesterName }),
      count: 1,
      returning,
      newStudents,
      startMs: first.startMs,
      students: [student],
    });
  }

  return [...byKey.values()]
    .map((source) => ({ ...source, students: sortStudents(source.students) }))
    .sort((a, b) => {
      if (a.newStudents !== b.newStudents) return a.newStudents ? -1 : 1;
      if (a.returning !== b.returning) return a.returning ? 1 : -1;
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      return a.label.localeCompare(b.label);
    });
}

export function buildEventFunnelPayload(params: {
  events: EventFunnelEvent[];
  attendances: EventFunnelAttendance[];
  firstEvents: EventFunnelFirstEvent[];
  current: { fromMs: number; toMs: number };
  semesters: EventFunnelSemester[];
  dateLabel: (startMs: number) => string;
  studentNames?: Map<number, string>;
}): EventFunnelPayload {
  const firstByStudent = pickFirstEvents(params.firstEvents);
  const attendeesByEvent = new Map<number, number[]>();

  for (const row of params.attendances) {
    const list = attendeesByEvent.get(row.eventId) ?? [];
    list.push(row.studentId);
    attendeesByEvent.set(row.eventId, list);
  }

  const sortedEvents = [...params.events].sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    return a.id - b.id;
  });

  const byEventId: Record<string, EventFunnelBreakdown> = {};
  for (const event of sortedEvents) {
    const attendeeIds = [...new Set(attendeesByEvent.get(event.id) ?? [])];
    const sources = buildSourcesForEvent(
      attendeeIds,
      firstByStudent,
      params.current,
      params.semesters,
      event.id,
      params.studentNames
    );
    byEventId[String(event.id)] = {
      total: attendeeIds.length,
      sources,
    };
  }

  return {
    events: sortedEvents.map((event) => ({
      id: event.id,
      name: event.name,
      dateLabel: params.dateLabel(event.startMs),
    })),
    byEventId,
  };
}
