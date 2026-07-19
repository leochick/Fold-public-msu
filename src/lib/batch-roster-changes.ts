import type { BatchRosterIncoming } from "@/lib/contracts/students";
import { appendStampedLine } from "@/lib/append-stamped-line";

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

function fmtDate(value: unknown): string {
  if (value == null || value === "") return "—";
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", { timeZone: "UTC" });
  }
  if (typeof value === "string") {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (iso) {
      const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0));
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", { timeZone: "UTC" });
      }
    }
  }
  return String(value);
}

function fmtSalvationType(value: unknown): string {
  if (value === "salvation") return "Salvation";
  if (value === "lordship") return "Lordship";
  return fmt(value);
}

function courseList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

const APPEND_ON_MERGE_FIELDS = new Set(["goals", "notes"]);

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
    const merging = Boolean(existingRecord);
    let after: string;
    if (merging && APPEND_ON_MERGE_FIELDS.has(key) && typeof value === "string") {
      after = appendStampedLine(typeof before === "string" ? before : null, value) ?? fmt(value);
    } else if (key === "igHandle" && typeof value === "string") {
      after = `@${value.replace(/^@/, "")}`;
    } else {
      after = fmt(value);
    }
    changes.push({
      label,
      before: existingRecord ? fmt(before) : undefined,
      after,
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

  if (incoming.salvationDecisionAt) {
    changes.push({
      label: "Salvation decision date",
      before: existingRecord ? fmtDate(existingRecord.salvationDecisionAt) : undefined,
      after: fmtDate(incoming.salvationDecisionAt),
    });
  }

  if (incoming.salvationDecisionType) {
    changes.push({
      label: "Salvation decision type",
      before: existingRecord ? fmtSalvationType(existingRecord.salvationDecisionType) : undefined,
      after: fmtSalvationType(incoming.salvationDecisionType),
    });
  }

  if (incoming.salvationDecisionNotes != null && incoming.salvationDecisionNotes !== "") {
    changes.push({
      label: "Salvation decision notes",
      before: existingRecord ? fmt(existingRecord.salvationDecisionNotes) : undefined,
      after: fmt(incoming.salvationDecisionNotes),
    });
  }

  return changes;
}

export function hasIncomingUpdates(incoming: BatchRosterIncoming): boolean {
  return getIncomingFieldChanges(incoming).length > 0;
}
