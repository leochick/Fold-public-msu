export const DECISION_KIND_OPTIONS = [
  { value: "salvation", label: "Salvation Decisions" },
  { value: "lordship", label: "Lordship Decisions" },
  { value: "both", label: "Both" },
] as const;

export type DecisionKind = (typeof DECISION_KIND_OPTIONS)[number]["value"];
export type DecisionType = "salvation" | "lordship";

export type DecisionStudent = {
  id: number;
  firstName: string;
  lastName: string | null;
  /** Calendar date, YYYY-MM-DD. */
  decisionAt: string;
  decisionType: DecisionType | null;
  notes: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDecisionKind(raw: string | undefined): DecisionKind {
  if (raw === "salvation" || raw === "lordship" || raw === "both") return raw;
  return "both";
}

export function isValidDecisionRange(from: string, to: string): boolean {
  return ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to;
}

export function decisionTypeLabel(type: DecisionType | null): string {
  if (type === "salvation") return "Salvation";
  if (type === "lordship") return "Lordship";
  return "Unspecified";
}

export function decisionStudentName(student: Pick<DecisionStudent, "firstName" | "lastName">): string {
  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

export function filterDecisionStudents(
  students: DecisionStudent[],
  opts: { from: string; to: string; kind: DecisionKind }
): DecisionStudent[] {
  if (!isValidDecisionRange(opts.from, opts.to)) return [];

  return students
    .filter((student) => {
      if (!ISO_DATE.test(student.decisionAt)) return false;
      if (student.decisionAt < opts.from || student.decisionAt > opts.to) return false;
      if (opts.kind === "both") return true;
      return student.decisionType === opts.kind;
    })
    .sort((a, b) => {
      if (a.decisionAt !== b.decisionAt) return b.decisionAt.localeCompare(a.decisionAt);
      const byLast = (a.lastName ?? "").localeCompare(b.lastName ?? "", undefined, {
        sensitivity: "base",
      });
      if (byLast !== 0) return byLast;
      return a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
    });
}
