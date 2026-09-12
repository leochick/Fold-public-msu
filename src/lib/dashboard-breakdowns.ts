export type BreakdownStudent = {
  id: number;
  name: string;
};

export type BreakdownSegment = {
  name: string;
  value: number;
  students: BreakdownStudent[];
};

const YEAR_ORDER = ["freshman", "sophomore", "junior", "senior", "grad", "other"];
const GENDER_ORDER = ["Male", "Female"];

export function formatBreakdownStudentName(
  firstName: string,
  lastName: string | null | undefined,
  id: number
): string {
  const name = `${firstName} ${lastName ?? ""}`.trim();
  return name || `Student ${id}`;
}

function sortStudents(students: BreakdownStudent[]): BreakdownStudent[] {
  return [...students].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.id - b.id;
  });
}

function segmentsFromGroups(
  groups: Map<string, BreakdownStudent[]>,
  order: string[]
): BreakdownSegment[] {
  return [...groups.entries()]
    .sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a[0].localeCompare(b[0]);
    })
    .map(([name, students]) => ({
      name,
      value: students.length,
      students: sortStudents(students),
    }));
}

export const BREAKDOWN_TOOLTIP_NAMES_PER_COLUMN = 12;
export const BREAKDOWN_TOOLTIP_COLUMN_WIDTH = 148;
export const BREAKDOWN_TOOLTIP_ROW_HEIGHT = 18;
export const BREAKDOWN_TOOLTIP_HEADER_HEIGHT = 58;

export function breakdownTooltipColumns(studentCount: number, maxColumns = 8): number {
  if (studentCount <= 0) return 1;
  return Math.min(maxColumns, Math.max(1, Math.ceil(studentCount / BREAKDOWN_TOOLTIP_NAMES_PER_COLUMN)));
}

export function breakdownTooltipSize(studentCount: number, maxColumns = 8) {
  const columns = breakdownTooltipColumns(studentCount, maxColumns);
  const rows = Math.max(1, Math.ceil(Math.max(studentCount, 1) / columns));
  return {
    columns,
    width: Math.max(256, columns * BREAKDOWN_TOOLTIP_COLUMN_WIDTH + 24),
    height: BREAKDOWN_TOOLTIP_HEADER_HEIGHT + rows * BREAKDOWN_TOOLTIP_ROW_HEIGHT,
  };
}

export function studentListTooltipMaxColumns(viewportWidth?: number) {
  const width = viewportWidth ?? (typeof window === "undefined" ? 1200 : window.innerWidth);
  return Math.max(2, Math.floor((width - 48) / 150));
}

export function studentListTooltipPosition(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  viewport?: { width: number; height: number }
) {
  const view = viewport ?? {
    width: typeof window === "undefined" ? 1200 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  };
  const pad = 8;
  const offset = 14;
  const maxX = view.width - width - pad;
  const maxY = view.height - height - pad;
  let x = clientX + offset;
  let y = clientY + offset;
  if (x > maxX) x = clientX - width - offset;
  if (y > maxY) y = clientY - height - offset;
  return {
    x: Math.min(Math.max(x, pad), Math.max(pad, maxX)),
    y: Math.min(Math.max(y, pad), Math.max(pad, maxY)),
  };
}

export function genderBreakdownLabel(gender: string | null | undefined): string | null {
  if (gender === "M") return "Male";
  if (gender === "F") return "Female";
  return null;
}

export function buildYearBreakdown(
  students: { id: number; name: string; year: string | null | undefined }[]
): BreakdownSegment[] {
  const groups = new Map<string, BreakdownStudent[]>();
  for (const student of students) {
    if (!student.year) continue;
    const list = groups.get(student.year) ?? [];
    list.push({ id: student.id, name: student.name });
    groups.set(student.year, list);
  }
  return segmentsFromGroups(groups, YEAR_ORDER);
}

export function buildGenderBreakdown(
  students: { id: number; name: string; gender: string | null | undefined }[]
): BreakdownSegment[] {
  const groups = new Map<string, BreakdownStudent[]>();
  for (const student of students) {
    const label = genderBreakdownLabel(student.gender);
    if (!label) continue;
    const list = groups.get(label) ?? [];
    list.push({ id: student.id, name: student.name });
    groups.set(label, list);
  }
  return segmentsFromGroups(groups, GENDER_ORDER);
}

export function buildEventTypeBreakdown(
  eventCounts: { type: string | null | undefined; count: number }[],
  attendanceTypes: { studentId: number; eventType: string | null | undefined }[],
  studentsById: Map<number, BreakdownStudent>
): BreakdownSegment[] {
  const studentsByType = new Map<string, Map<number, BreakdownStudent>>();
  for (const row of attendanceTypes) {
    const type = row.eventType?.trim();
    if (!type) continue;
    const student = studentsById.get(row.studentId);
    if (!student) continue;
    const bucket = studentsByType.get(type) ?? new Map<number, BreakdownStudent>();
    bucket.set(student.id, student);
    studentsByType.set(type, bucket);
  }

  return eventCounts
    .filter((row) => row.type && row.count > 0)
    .map((row) => {
      const name = row.type as string;
      return {
        name,
        value: row.count,
        students: sortStudents([...(studentsByType.get(name)?.values() ?? [])]),
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
