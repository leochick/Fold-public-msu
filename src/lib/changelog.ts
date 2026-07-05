export const STUDENT_FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  studentId: "Student ID",
  gender: "Gender",
  year: "Year",
  phone: "Phone",
  email: "Email",
  igHandle: "IG handle",
  memberStatus: "Status",
  isActive: "Active",
  newsletter: "Newsletter",
  groupme: "Groupme",
  contactedViaIg: "In IG groupchat",
  primaryContact: "Primary contact",
  goals: "Goals",
  notes: "Notes",
  courseMaterial: "Course material",
  invitedByStudentId: "Invited by",
  funnelStage: "Funnel stage",
};

export const EVENT_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  type: "Type",
  startDate: "Date",
  endDate: "End date",
  location: "Location",
  notes: "Notes",
  totalStudents: "Total students",
};

export const STUDENT_CHANGE_FIELDS = Object.keys(STUDENT_FIELD_LABELS);
export const EVENT_CHANGE_FIELDS = Object.keys(EVENT_FIELD_LABELS);

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", { timeZone: "UTC" });
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

export function formatStudentLabel(student: { firstName: string; lastName?: string | null }) {
  return `${student.firstName}${student.lastName ? ` ${student.lastName}` : ""}`.trim();
}

export function formatEventLabel(event: { name: string; startDate?: Date | string | null }) {
  const date =
    event.startDate instanceof Date
      ? event.startDate.toLocaleDateString("en-US", { timeZone: "UTC" })
      : event.startDate
        ? String(event.startDate)
        : "";
  return date ? `${event.name} (${date})` : event.name;
}

export function listFieldChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fields: string[],
  labels: Record<string, string>
): string[] {
  const parts: string[] = [];
  for (const field of fields) {
    const oldValue = before?.[field];
    const newValue = after?.[field];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;

    const oldDisplay = formatValue(oldValue);
    const newDisplay = formatValue(newValue);
    if (oldDisplay === newDisplay) continue;

    parts.push(`${labels[field] ?? field}: ${oldDisplay} → ${newDisplay}`);
  }
  return parts;
}

export function describeFieldChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fields: string[],
  labels: Record<string, string>
): string {
  return listFieldChanges(before, after, fields, labels).join("\n");
}

export function pickStudentFields(student: Record<string, unknown>) {
  return Object.fromEntries(STUDENT_CHANGE_FIELDS.map((field) => [field, student[field] ?? null]));
}

export function formatChangelogSummaryForDisplay(
  summary: string,
  action: "create" | "update" | "delete" | "merge"
): string {
  if (!summary.trim()) return "";

  if (action !== "update") return summary;

  let text = summary.trim();
  text = text.replace(/^[^:]+:\s*Updated\s.+?:\s*/i, "");
  text = text.replace(/^Updated\s.+?:\s*/i, "");
  return text
    .replace(/;\s+/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^[^:]+:\s*—\s*→\s*—$/i.test(line))
    .join("\n");
}
