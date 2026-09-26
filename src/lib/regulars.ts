export type RegularsGender = "M" | "F" | null;

export type RegularsStudent = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: RegularsGender;
};

export type RegularsEvent = {
  id: number;
  name: string;
  type: string | null;
  startDate: string;
};

export type RegularsAttendance = {
  studentId: number;
  eventId: number;
};

export type RegularsPayload = {
  semesterId: number;
  semesterName: string;
  events: RegularsEvent[];
  students: RegularsStudent[];
  attendances: RegularsAttendance[];
};

export type RegularsContainer = {
  title: string;
  eventIds: number[];
};

export const NO_EVENT_TYPE_LABEL = "No type";

export function studentDisplayName(student: Pick<RegularsStudent, "firstName" | "lastName">): string {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

export function regularsForEvents(
  eventIds: number[],
  students: RegularsStudent[],
  attendances: RegularsAttendance[],
  minimum: number
): RegularsStudent[] {
  if (eventIds.length === 0) return [];
  const minimumCount = Number.isFinite(minimum) ? Math.max(0, Math.floor(minimum)) : 0;
  const allowed = new Set(eventIds);
  const seen = new Set<string>();
  const counts = new Map<number, number>();

  for (const row of attendances) {
    if (!allowed.has(row.eventId)) continue;
    const key = `${row.studentId}:${row.eventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1);
  }

  return students
    .filter((student) => (counts.get(student.id) ?? 0) >= minimumCount)
    .slice()
    .sort((a, b) =>
      studentDisplayName(a).localeCompare(studentDisplayName(b), undefined, { sensitivity: "base" })
    );
}

export type GenderGroups = {
  male: RegularsStudent[];
  female: RegularsStudent[];
  unspecified: RegularsStudent[];
};

export function genderGroups(regulars: RegularsStudent[]): GenderGroups {
  const groups: GenderGroups = { male: [], female: [], unspecified: [] };
  for (const student of regulars) {
    if (student.gender === "M") groups.male.push(student);
    else if (student.gender === "F") groups.female.push(student);
    else groups.unspecified.push(student);
  }
  return groups;
}

export function groupEventsByType(events: RegularsEvent[]): RegularsContainer[] {
  const groups = new Map<string, RegularsEvent[]>();
  for (const event of events) {
    const title = event.type?.trim() || NO_EVENT_TYPE_LABEL;
    const list = groups.get(title) ?? [];
    list.push(event);
    groups.set(title, list);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === NO_EVENT_TYPE_LABEL) return 1;
      if (right === NO_EVENT_TYPE_LABEL) return -1;
      return left.localeCompare(right);
    })
    .map(([title, grouped]) => ({
      title,
      eventIds: [...grouped]
        .sort((a, b) => {
          const byDate = a.startDate.localeCompare(b.startDate);
          if (byDate !== 0) return byDate;
          return a.name.localeCompare(b.name);
        })
        .map((event) => event.id),
    }));
}

export function insertEvent(
  containers: RegularsContainer[],
  containerIndex: number,
  eventId: number,
  insertAt: number
): RegularsContainer[] {
  let fromContainerIndex = -1;
  let fromIndex = -1;
  for (let index = 0; index < containers.length; index += 1) {
    const foundIndex = containers[index].eventIds.indexOf(eventId);
    if (foundIndex >= 0) {
      fromContainerIndex = index;
      fromIndex = foundIndex;
      break;
    }
  }

  return containers.map((container, index) => {
    const eventIds = container.eventIds.filter((id) => id !== eventId);
    if (index !== containerIndex) return { ...container, eventIds };

    let adjustedInsert = insertAt;
    if (fromContainerIndex === containerIndex && fromIndex >= 0 && fromIndex < insertAt) {
      adjustedInsert -= 1;
    }
    const clamped = Math.min(Math.max(adjustedInsert, 0), eventIds.length);
    eventIds.splice(clamped, 0, eventId);
    return { ...container, eventIds };
  });
}

export function removeEvent(containers: RegularsContainer[], eventId: number): RegularsContainer[] {
  return containers.map((container) => ({
    ...container,
    eventIds: container.eventIds.filter((id) => id !== eventId),
  }));
}

export function containerDisplayTitle(title: string, index: number): string {
  const trimmed = title.trim();
  return trimmed || `Container ${index + 1}`;
}
