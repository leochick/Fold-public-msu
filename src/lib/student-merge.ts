import type { Student } from "../../drizzle/schema";

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
  | "isActive"
  | "newsletter"
  | "groupme"
  | "contactedViaIg"
  | "primaryContact"
  | "goals"
  | "notes"
  | "courseMaterial"
  | "funnelStage"
>;

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

export type MergePreviewResult = {
  fields: MergePreviewField[];
  values: Record<string, string | boolean | string[] | null>;
};

const FUNNEL_ORDER = ["active", "engaged", "inactive"] as const;

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
    return { value: null, conflict: true };
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

function mergeFunnelStage(
  left: Student["funnelStage"],
  right: Student["funnelStage"]
): Student["funnelStage"] {
  if (left === "inactive" && right !== "inactive") return right;
  if (right === "inactive" && left !== "inactive") return left;
  const leftIdx = FUNNEL_ORDER.indexOf(left);
  const rightIdx = FUNNEL_ORDER.indexOf(right);
  return FUNNEL_ORDER[Math.max(leftIdx, rightIdx)] ?? left;
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

  const resolvedFirst = overrides.firstName ?? first.value ?? keep.firstName;
  const resolvedLast = overrides.lastName ?? last.value ?? keep.lastName ?? null;
  const resolvedPhone = overrides.phone ?? phone.value ?? keep.phone ?? null;
  const resolvedEmail = overrides.email ?? email.value ?? keep.email ?? null;

  const mergedNotes = mergeNotes(keep.notes, merge.notes);
  const mergedCourses = mergeCourseMaterial(keep.courseMaterial, merge.courseMaterial);
  const mergedFunnel = mergeFunnelStage(keep.funnelStage, merge.funnelStage);

  const values: MergePreviewResult["values"] = {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    phone: resolvedPhone,
    email: resolvedEmail,
    igHandle: ig.value,
    studentId: studentId.value,
    gender: gender.value,
    year: year.value,
    memberStatus: memberStatus.value,
    primaryContact: primaryContact.value,
    goals: goals.value,
    notes: mergedNotes,
    courseMaterial: mergedCourses,
    funnelStage: mergedFunnel,
    isActive: mergeBoolean(keep.isActive, merge.isActive),
    newsletter: mergeBoolean(keep.newsletter, merge.newsletter),
    groupme: mergeBoolean(keep.groupme, merge.groupme),
    contactedViaIg: mergeBoolean(keep.contactedViaIg, merge.contactedViaIg),
  };

  const fields: MergePreviewField[] = [
    previewTextField("firstName", "First name", keep.firstName, merge.firstName, resolvedFirst, first.conflict),
    previewTextField("lastName", "Last name", keep.lastName, merge.lastName, resolvedLast, last.conflict),
    previewTextField("phone", "Phone", keep.phone, merge.phone, resolvedPhone, phone.conflict),
    previewTextField("email", "Email", keep.email, merge.email, resolvedEmail, email.conflict),
    previewTextField("igHandle", "Instagram", keep.igHandle, merge.igHandle, ig.value, ig.conflict),
    previewTextField("studentId", "Student ID", keep.studentId, merge.studentId, studentId.value, studentId.conflict),
    previewTextField("year", "Year", keep.year, merge.year, year.value, year.conflict),
    previewTextField("gender", "Gender", keep.gender, merge.gender, gender.value, gender.conflict),
    previewTextField(
      "memberStatus",
      "Member status",
      keep.memberStatus,
      merge.memberStatus,
      memberStatus.value,
      memberStatus.conflict
    ),
    previewTextField(
      "primaryContact",
      "Primary contact",
      keep.primaryContact,
      merge.primaryContact,
      primaryContact.value,
      primaryContact.conflict
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
    {
      key: "contactedViaIg",
      label: "Contacted via IG",
      left: keep.contactedViaIg ? "Yes" : "No",
      right: merge.contactedViaIg ? "Yes" : "No",
      value: values.contactedViaIg ? "Yes" : "No",
      conflict: keep.contactedViaIg !== merge.contactedViaIg,
      editable: false,
    },
    {
      key: "isActive",
      label: "Active",
      left: keep.isActive ? "Yes" : "No",
      right: merge.isActive ? "Yes" : "No",
      value: values.isActive ? "Yes" : "No",
      conflict: keep.isActive !== merge.isActive,
      editable: false,
    },
    {
      key: "funnelStage",
      label: "Funnel stage",
      left: displayText(keep.funnelStage),
      right: displayText(merge.funnelStage),
      value: displayText(mergedFunnel),
      conflict: keep.funnelStage !== merge.funnelStage,
      editable: false,
    },
  ];

  return { fields, values };
}
