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

export type EventFunnelSource = {
  key: string;
  eventId: number;
  label: string;
  count: number;
  returning: boolean;
  startMs: number;
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
  semesterName: string | null;
}): string {
  if (!params.returning) return params.eventName;
  return `${params.eventName} (${params.semesterName ?? PREVIOUS_SEMESTER_FALLBACK})`;
}

export function buildSourcesForEvent(
  attendeeIds: number[],
  firstByStudent: Map<number, EventFunnelFirstEvent>,
  current: { fromMs: number; toMs: number },
  semesters: EventFunnelSemester[]
): EventFunnelSource[] {
  const byKey = new Map<string, EventFunnelSource>();

  for (const studentId of attendeeIds) {
    const first = firstByStudent.get(studentId);
    if (!first) continue;

    const returning = !isInRange(first.startMs, current.fromMs, current.toMs);
    const semesterName = returning ? semesterNameForDate(first.startMs, semesters) : null;
    const key = `${returning ? "r" : "c"}:${first.eventId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    byKey.set(key, {
      key,
      eventId: first.eventId,
      label: sourceLabel({ eventName: first.name, returning, semesterName }),
      count: 1,
      returning,
      startMs: first.startMs,
    });
  }

  return [...byKey.values()].sort((a, b) => {
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
      params.semesters
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
