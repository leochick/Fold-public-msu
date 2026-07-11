import type { BatchRosterIncoming } from "@/lib/contracts/students";

export type FieldChange = {
  label: string;
  before?: string;
  after: string;
};

function fmt(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function courseList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function getIncomingFieldChanges(
  incoming: BatchRosterIncoming,
  existingRecord?: Record<string, unknown> | null
): FieldChange[] {
  const changes: FieldChange[] = [];

  const scalarFields: { key: keyof BatchRosterIncoming; label: string }[] = [
    { key: "year", label: "Year" },
    { key: "gender", label: "Gender" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "igHandle", label: "Instagram" },
    { key: "memberStatus", label: "Member status" },
    { key: "newsletter", label: "Newsletter" },
    { key: "groupme", label: "Groupme" },
    { key: "contactedViaIg", label: "Contacted via IG" },
    { key: "primaryContact", label: "Primary contact" },
    { key: "goals", label: "Goals" },
    { key: "notes", label: "Notes" },
  ];

  for (const { key, label } of scalarFields) {
    const value = incoming[key];
    if (value == null || value === "") continue;
    const before = existingRecord?.[key];
    changes.push({
      label,
      before: existingRecord ? fmt(before) : undefined,
      after: key === "igHandle" && typeof value === "string" ? `@${value.replace(/^@/, "")}` : fmt(value),
    });
  }

  if (incoming.courseMaterialAdd?.length) {
    const beforeCourses = courseList(existingRecord?.courseMaterial);
    const afterCourses = [...new Set([...beforeCourses, ...incoming.courseMaterialAdd])];
    changes.push({
      label: "Course material",
      before: existingRecord ? fmt(beforeCourses) : undefined,
      after: afterCourses.join(", "),
    });
  }

  return changes;
}

export function hasIncomingUpdates(incoming: BatchRosterIncoming): boolean {
  return getIncomingFieldChanges(incoming).length > 0;
}
