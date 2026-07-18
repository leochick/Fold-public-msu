import type { Student } from "../../drizzle/schema";
import { formatPersonRef } from "@/lib/parse-student";

export type MergeStudentRecord = Pick<
  Student,
  | "id"
  | "firstName"
  | "lastName"
  | "studentId"
  | "gender"
  | "year"
  | "phone"
  | "email"
  | "igHandle"
  | "memberStatus"
  | "newsletter"
  | "groupme"
  | "contactedViaIg"
  | "primaryContact"
  | "goals"
  | "notes"
  | "courseMaterial"
  | "invitedByStudentId"
  | "invitedByStaffId"
  | "eventInvitedToId"
  | "ledToChristByStudentId"
  | "ledToChristByStaffId"
  | "salvationDecisionAt"
  | "salvationDecisionType"
  | "salvationDecisionNotes"
> & {
  invitedByLabel?: string | null;
  ledToChristByLabel?: string | null;
  eventInvitedToLabel?: string | null;
};

export const MERGE_EDITABLE_FIELDS = ["firstName", "lastName", "phone", "email"] as const;
export type MergeEditableField = (typeof MERGE_EDITABLE_FIELDS)[number];

export type MergePreviewField = {
  key: string;
  label: string;
  left: string;
  right: string;
  value: string;
  conflict: boolean;
  editable: boolean;
};

export type MergePreviewValues = {
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  igHandle: string | null;
  studentId: string | null;
  gender: Student["gender"];
  year: Student["year"];
  memberStatus: Student["memberStatus"];
  primaryContact: string | null;
  goals: string | null;
  notes: string | null;
  courseMaterial: string[];
  newsletter: boolean;
  groupme: boolean;
  contactedViaIg: boolean;
  invitedByStudentId: number | null;
  invitedByStaffId: number | null;
  eventInvitedToId: number | null;
  ledToChristByStudentId: number | null;
  ledToChristByStaffId: number | null;
  salvationDecisionAt: Date | null;
  salvationDecisionType: Student["salvationDecisionType"];
  salvationDecisionNotes: string | null;
};

export type MergePreviewResult = {
  fields: MergePreviewField[];
  values: MergePreviewValues;
};

function normText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function displayText(value: string | null | undefined): string {
  const text = normText(value);
  return text || "—";
}

function pickText(
  left: string | null | undefined,
  right: string | null | undefined
): { value: string | null; conflict: boolean } {
  const a = normText(left);
  const b = normText(right);
  if (a && b && a.toLowerCase() !== b.toLowerCase()) {
    return { value: a, conflict: true };
  }
  return { value: a || b || null, conflict: false };
}

function mergeBoolean(left: boolean, right: boolean): boolean {
  return left || right;
}

function mergeCourseMaterial(left: unknown, right: unknown): string[] {
  const a = Array.isArray(left) ? left.map(String) : [];
  const b = Array.isArray(right) ? right.map(String) : [];
  return [...new Set([...a, ...b])];
}

function mergeNotes(left: string | null | undefined, right: string | null | undefined): string | null {
  const a = normText(left);
  const b = normText(right);
  if (!a) return b || null;
  if (!b) return a;
  if (a === b) return a;
  return `${a}\n\n---\n\n${b}`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateDisplay(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}

function pickDate(
  left: Date | string | null | undefined,
  right: Date | string | null | undefined
): { value: Date | null; conflict: boolean } {
  const a = toDate(left);
  const b = toDate(right);
  if (a && b && a.getTime() !== b.getTime()) {
    return { value: a, conflict: true };
  }
  return { value: a ?? b, conflict: false };
}

function pickNumber(
  left: number | null | undefined,
  right: number | null | undefined
): { value: number | null; conflict: boolean } {
  const a = left == null ? null : Number(left);
  const b = right == null ? null : Number(right);
  const aOk = a != null && Number.isFinite(a);
  const bOk = b != null && Number.isFinite(b);
  if (aOk && bOk && a !== b) {
    return { value: a, conflict: true };
  }
  return { value: aOk ? a : bOk ? b : null, conflict: false };
}

function personRef(
  studentId: number | null | undefined,
  staffId: number | null | undefined
): string | null {
  if (staffId != null) return formatPersonRef("staff", staffId);
  if (studentId != null) return formatPersonRef("student", studentId);
  return null;
}

function parsePersonRef(ref: string | null): {
  studentId: number | null;
  staffId: number | null;
} {
  if (!ref) return { studentId: null, staffId: null };
  const match = /^(student|staff):(\d+)$/.exec(ref);
  if (!match) return { studentId: null, staffId: null };
  const id = Number(match[2]);
  if (!Number.isFinite(id)) return { studentId: null, staffId: null };
  if (match[1] === "student") return { studentId: id, staffId: null };
  return { studentId: null, staffId: id };
}

function remapPersonRef(ref: string | null, mergeId: number, keepId: number): string | null {
  if (!ref) return null;
  const parsed = parsePersonRef(ref);
  if (parsed.studentId === mergeId || parsed.studentId === keepId) return null;
  return ref;
}

function salvationTypeLabel(value: string | null | undefined): string {
  if (value === "salvation") return "Salvation";
  if (value === "lordship") return "Lordship";
  return displayText(value);
}

function previewTextField(
  key: string,
  label: string,
  left: string | null | undefined,
  right: string | null | undefined,
  merged: string | null,
  conflict: boolean
): MergePreviewField {
  const editable = MERGE_EDITABLE_FIELDS.includes(key as MergeEditableField);
  return {
    key,
    label,
    left: displayText(left),
    right: displayText(right),
    value: displayText(merged),
    conflict,
    editable: conflict && editable,
  };
}

export function toMergeStudentRecord(
  student: Pick<
    Student,
    | "id"
    | "firstName"
    | "lastName"
    | "studentId"
    | "gender"
    | "year"
    | "phone"
    | "email"
    | "igHandle"
    | "memberStatus"
    | "newsletter"
    | "groupme"
    | "contactedViaIg"
    | "primaryContact"
    | "goals"
    | "notes"
    | "courseMaterial"
    | "invitedByStudentId"
    | "invitedByStaffId"
    | "eventInvitedToId"
    | "ledToChristByStudentId"
    | "ledToChristByStaffId"
    | "salvationDecisionAt"
    | "salvationDecisionType"
    | "salvationDecisionNotes"
  >,
  studentNames: Map<number, string>,
  staffNames: Map<number, string>,
  eventNames: Map<number, string>
): MergeStudentRecord {
  const invitedByLabel =
    student.invitedByStaffId != null
      ? staffNames.get(student.invitedByStaffId) ?? formatPersonRef("staff", student.invitedByStaffId)
      : student.invitedByStudentId != null
        ? studentNames.get(student.invitedByStudentId) ??
          formatPersonRef("student", student.invitedByStudentId)
        : null;
  const ledToChristByLabel =
    student.ledToChristByStaffId != null
      ? staffNames.get(student.ledToChristByStaffId) ??
        formatPersonRef("staff", student.ledToChristByStaffId)
      : student.ledToChristByStudentId != null
        ? studentNames.get(student.ledToChristByStudentId) ??
          formatPersonRef("student", student.ledToChristByStudentId)
        : null;
  const eventInvitedToLabel =
    student.eventInvitedToId != null
      ? eventNames.get(student.eventInvitedToId) ?? `Event #${student.eventInvitedToId}`
      : null;

  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    studentId: student.studentId,
    gender: student.gender,
    year: student.year,
    phone: student.phone,
    email: student.email,
    igHandle: student.igHandle,
    memberStatus: student.memberStatus,
    newsletter: student.newsletter,
    groupme: student.groupme,
    contactedViaIg: student.contactedViaIg,
    primaryContact: student.primaryContact,
    goals: student.goals,
    notes: student.notes,
    courseMaterial: student.courseMaterial,
    invitedByStudentId: student.invitedByStudentId,
    invitedByStaffId: student.invitedByStaffId,
    eventInvitedToId: student.eventInvitedToId,
    ledToChristByStudentId: student.ledToChristByStudentId,
    ledToChristByStaffId: student.ledToChristByStaffId,
    salvationDecisionAt: student.salvationDecisionAt,
    salvationDecisionType: student.salvationDecisionType,
    salvationDecisionNotes: student.salvationDecisionNotes,
    invitedByLabel,
    ledToChristByLabel,
    eventInvitedToLabel,
  };
}

export function buildMergePreview(
  keep: MergeStudentRecord,
  merge: MergeStudentRecord,
  overrides: Partial<Record<MergeEditableField, string>> = {}
): MergePreviewResult {
  const first = pickText(keep.firstName, merge.firstName);
  const last = pickText(keep.lastName, merge.lastName);
  const phone = pickText(keep.phone, merge.phone);
  const email = pickText(keep.email, merge.email);
  const ig = pickText(keep.igHandle, merge.igHandle);
  const studentId = pickText(keep.studentId, merge.studentId);
  const gender = pickText(keep.gender, merge.gender);
  const year = pickText(keep.year, merge.year);
  const memberStatus = pickText(keep.memberStatus, merge.memberStatus);
  const primaryContact = pickText(keep.primaryContact, merge.primaryContact);
  const goals = pickText(keep.goals, merge.goals);
  const decisionType = pickText(keep.salvationDecisionType, merge.salvationDecisionType);
  const decisionAt = pickDate(keep.salvationDecisionAt, merge.salvationDecisionAt);
  const eventInvited = pickNumber(keep.eventInvitedToId, merge.eventInvitedToId);

  const keepInvitedRef = personRef(keep.invitedByStudentId, keep.invitedByStaffId);
  const mergeInvitedRef = personRef(merge.invitedByStudentId, merge.invitedByStaffId);
  const invited = pickText(keepInvitedRef, mergeInvitedRef);
  const resolvedInvitedRef = remapPersonRef(invited.value, merge.id, keep.id);
  const invitedParsed = parsePersonRef(resolvedInvitedRef);

  const keepLedRef = personRef(keep.ledToChristByStudentId, keep.ledToChristByStaffId);
  const mergeLedRef = personRef(merge.ledToChristByStudentId, merge.ledToChristByStaffId);
  const led = pickText(keepLedRef, mergeLedRef);
  const resolvedLedRef = remapPersonRef(led.value, merge.id, keep.id);
  const ledParsed = parsePersonRef(resolvedLedRef);

  const resolvedFirst = overrides.firstName ?? first.value ?? keep.firstName;
  const resolvedLast = overrides.lastName ?? last.value ?? keep.lastName ?? null;
  const resolvedPhone = overrides.phone ?? phone.value ?? keep.phone ?? null;
  const resolvedEmail = overrides.email ?? email.value ?? keep.email ?? null;

  const mergedNotes = mergeNotes(keep.notes, merge.notes);
  const mergedDecisionNotes = mergeNotes(keep.salvationDecisionNotes, merge.salvationDecisionNotes);
  const mergedCourses = mergeCourseMaterial(keep.courseMaterial, merge.courseMaterial);

  const invitedLabel = invited.conflict
    ? keep.invitedByLabel ?? resolvedInvitedRef
    : keep.invitedByLabel || merge.invitedByLabel || resolvedInvitedRef;
  const ledLabel = led.conflict
    ? keep.ledToChristByLabel ?? resolvedLedRef
    : keep.ledToChristByLabel || merge.ledToChristByLabel || resolvedLedRef;
  const eventLabel = eventInvited.conflict
    ? keep.eventInvitedToLabel ?? (eventInvited.value != null ? String(eventInvited.value) : null)
    : keep.eventInvitedToLabel ||
      merge.eventInvitedToLabel ||
      (eventInvited.value != null ? String(eventInvited.value) : null);

  const values: MergePreviewValues = {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    phone: resolvedPhone,
    email: resolvedEmail,
    igHandle: ig.value,
    studentId: studentId.value,
    gender: (gender.value as Student["gender"]) ?? null,
    year: (year.value as Student["year"]) ?? null,
    memberStatus: (memberStatus.value as Student["memberStatus"]) ?? null,
    primaryContact: primaryContact.value,
    goals: goals.value,
    notes: mergedNotes,
    courseMaterial: mergedCourses,
    newsletter: mergeBoolean(keep.newsletter, merge.newsletter),
    groupme: mergeBoolean(keep.groupme, merge.groupme),
    contactedViaIg: mergeBoolean(keep.contactedViaIg, merge.contactedViaIg),
    invitedByStudentId: invitedParsed.studentId,
    invitedByStaffId: invitedParsed.staffId,
    eventInvitedToId: eventInvited.value,
    ledToChristByStudentId: ledParsed.studentId,
    ledToChristByStaffId: ledParsed.staffId,
    salvationDecisionAt: decisionAt.value,
    salvationDecisionType: (decisionType.value as Student["salvationDecisionType"]) ?? null,
    salvationDecisionNotes: mergedDecisionNotes,
  };

  const fields: MergePreviewField[] = [
    previewTextField("firstName", "First name", keep.firstName, merge.firstName, resolvedFirst, first.conflict),
    previewTextField("lastName", "Last name", keep.lastName, merge.lastName, resolvedLast, last.conflict),
    previewTextField("phone", "Phone", keep.phone, merge.phone, resolvedPhone, phone.conflict),
    previewTextField("email", "Email", keep.email, merge.email, resolvedEmail, email.conflict),
    previewTextField("igHandle", "Instagram", keep.igHandle, merge.igHandle, ig.value, ig.conflict),
    previewTextField("year", "Year", keep.year, merge.year, year.value, year.conflict),
    previewTextField("gender", "Gender", keep.gender, merge.gender, gender.value, gender.conflict),
    previewTextField(
      "invitedBy",
      "Invited by",
      keep.invitedByLabel ?? keepInvitedRef,
      merge.invitedByLabel ?? mergeInvitedRef,
      invitedLabel,
      invited.conflict
    ),
    previewTextField(
      "eventInvitedToId",
      "Event invited to",
      keep.eventInvitedToLabel ?? (keep.eventInvitedToId != null ? String(keep.eventInvitedToId) : null),
      merge.eventInvitedToLabel ?? (merge.eventInvitedToId != null ? String(merge.eventInvitedToId) : null),
      eventLabel,
      eventInvited.conflict
    ),
    previewTextField(
      "ledToChristBy",
      "Led to Christ by",
      keep.ledToChristByLabel ?? keepLedRef,
      merge.ledToChristByLabel ?? mergeLedRef,
      ledLabel,
      led.conflict
    ),
    {
      key: "salvationDecisionAt",
      label: "Salvation decision date",
      left: formatDateDisplay(keep.salvationDecisionAt),
      right: formatDateDisplay(merge.salvationDecisionAt),
      value: formatDateDisplay(decisionAt.value),
      conflict: decisionAt.conflict,
      editable: false,
    },
    previewTextField(
      "salvationDecisionType",
      "Salvation decision type",
      salvationTypeLabel(keep.salvationDecisionType),
      salvationTypeLabel(merge.salvationDecisionType),
      salvationTypeLabel(decisionType.value),
      decisionType.conflict
    ),
    previewTextField(
      "salvationDecisionNotes",
      "Salvation decision notes",
      keep.salvationDecisionNotes,
      merge.salvationDecisionNotes,
      mergedDecisionNotes,
      false
    ),
    previewTextField("goals", "Goals", keep.goals, merge.goals, goals.value, goals.conflict),
    previewTextField("notes", "Notes", keep.notes, merge.notes, mergedNotes, false),
    {
      key: "courseMaterial",
      label: "Course material",
      left: displayText(
        Array.isArray(keep.courseMaterial) ? keep.courseMaterial.join(", ") : keep.courseMaterial
      ),
      right: displayText(
        Array.isArray(merge.courseMaterial) ? merge.courseMaterial.join(", ") : merge.courseMaterial
      ),
      value: mergedCourses.length ? mergedCourses.join(", ") : "—",
      conflict: false,
      editable: false,
    },
    {
      key: "newsletter",
      label: "Newsletter",
      left: keep.newsletter ? "Yes" : "No",
      right: merge.newsletter ? "Yes" : "No",
      value: values.newsletter ? "Yes" : "No",
      conflict: keep.newsletter !== merge.newsletter,
      editable: false,
    },
    {
      key: "groupme",
      label: "Groupme",
      left: keep.groupme ? "Yes" : "No",
      right: merge.groupme ? "Yes" : "No",
      value: values.groupme ? "Yes" : "No",
      conflict: keep.groupme !== merge.groupme,
      editable: false,
    },
  ];

  return { fields, values };
}
