import { deriveClassYearFromGraduationYear } from "@/lib/class-year";

export type PersonRefEntity = "student" | "staff";

export type ParseStudentOptions = {
  today?: Date;
  springEndsByYear?: Readonly<Record<number, string>>;
};

function parsePersonRef(raw: string | null): {
  studentId: number | null;
  staffId: number | null;
} {
  if (!raw) return { studentId: null, staffId: null };
  const match = /^(student|staff):(\d+)$/.exec(raw);
  if (!match) return { studentId: null, staffId: null };
  const id = Number(match[2]);
  if (!Number.isFinite(id)) return { studentId: null, staffId: null };
  if (match[1] === "student") return { studentId: id, staffId: null };
  return { studentId: null, staffId: id };
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatPersonRef(
  entity: PersonRefEntity | null | undefined,
  id: number | null | undefined
): string {
  if (!entity || id == null) return "";
  return `${entity}:${id}`;
}

export function formatDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function parseStudent(f: FormData, options: ParseStudentOptions = {}) {
  const v = (k: string) => {
    const x = f.get(k);
    return x == null || x === "" ? null : String(x);
  };
  const b = (k: string) => f.get(k) === "on";
  const invited = parsePersonRef(v("invitedBy"));
  const ledToChrist = parsePersonRef(v("ledToChristBy"));
  const eventInvitedRaw = v("eventInvitedToId");
  const eventInvitedNum = eventInvitedRaw == null ? null : Number(eventInvitedRaw);

  const graduationYearRaw = v("graduationYear");
  const graduationYearNum = graduationYearRaw == null ? null : Number(graduationYearRaw);
  const graduationYear =
    graduationYearNum != null && Number.isFinite(graduationYearNum)
      ? Math.trunc(graduationYearNum)
      : null;

  return {
    firstName: v("firstName") ?? "",
    lastName: v("lastName"),
    gender: (v("gender") as "M" | "F" | null) ?? null,
    // Year is derived from Graduation Year (form Year control is read-only).
    year: deriveClassYearFromGraduationYear(
      graduationYear,
      options.today,
      options.springEndsByYear
    ) as never,
    graduationYear,
    phone: v("phone"),
    email: v("email"),
    igHandle: v("igHandle")?.replace(/^@/, "") ?? null,
    newsletter: b("newsletter"),
    groupme: b("groupme"),
    goals: v("goals"),
    notes: v("notes"),
    courseMaterial: f.getAll("courseMaterial").map(String).filter(Boolean),
    invitedByStudentId: invited.studentId,
    invitedByStaffId: invited.staffId,
    eventInvitedToId:
      eventInvitedNum != null && Number.isFinite(eventInvitedNum) ? eventInvitedNum : null,
    ledToChristByStudentId: ledToChrist.studentId,
    ledToChristByStaffId: ledToChrist.staffId,
    salvationDecisionAt: parseDate(v("salvationDecisionAt")),
    salvationDecisionType: (v("salvationDecisionType") as "salvation" | "lordship" | null) ?? null,
    salvationDecisionNotes: v("salvationDecisionNotes"),
    baptismDate: parseDate(v("baptismDate")),
  };
}
