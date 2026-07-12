import type { BatchEventIncoming } from "@/lib/contracts/events";
import { appendStampedLine } from "@/lib/append-stamped-line";

export type FieldChange = {
  label: string;
  before?: string;
  after: string;
};

function fmt(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function getIncomingEventFieldChanges(
  incoming: BatchEventIncoming,
  existingRecord?: Record<string, unknown> | null
): FieldChange[] {
  const changes: FieldChange[] = [];

  const scalarFields: { key: keyof BatchEventIncoming; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "location", label: "Location" },
    { key: "notes", label: "Notes" },
    { key: "totalStudents", label: "Total students" },
  ];

  for (const { key, label } of scalarFields) {
    const value = incoming[key];
    if (value == null || value === "") continue;
    const before = existingRecord?.[key];
    const merging = Boolean(existingRecord);
    let after: string;
    if (merging && key === "notes" && typeof value === "string") {
      after = appendStampedLine(typeof before === "string" ? before : null, value) ?? fmt(value);
    } else {
      after = fmt(value);
    }
    changes.push({
      label,
      before: existingRecord ? fmt(before) : undefined,
      after,
    });
  }

  return changes;
}

export function hasIncomingEventUpdates(incoming: BatchEventIncoming): boolean {
  return getIncomingEventFieldChanges(incoming).length > 0;
}
