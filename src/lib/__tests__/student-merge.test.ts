import { describe, expect, it } from "vitest";
import { buildMergePreview } from "../student-merge";

describe("buildMergePreview", () => {
  const keep = {
    id: 1,
    firstName: "Nyah",
    lastName: "Morefield",
    studentId: null,
    gender: null,
    year: null,
    phone: null,
    email: "old@msu.edu",
    igHandle: null,
    memberStatus: null,
    newsletter: false,
    groupme: false,
    contactedViaIg: false,
    primaryContact: null,
    goals: null,
    notes: "Keep notes",
    courseMaterial: ["Course 101"],
    invitedByStudentId: null,
    invitedByStaffId: 3,
    eventInvitedToId: 10,
    ledToChristByStudentId: null,
    ledToChristByStaffId: null,
    salvationDecisionAt: new Date(Date.UTC(2026, 0, 5)),
    salvationDecisionType: "salvation" as const,
    salvationDecisionNotes: "At retreat",
    invitedByLabel: "Aaron (staff)",
    ledToChristByLabel: null,
    eventInvitedToLabel: "Welcome Night (1/10/2026)",
  };

  const merge = {
    id: 2,
    firstName: "Nyah",
    lastName: "Moorfield",
    studentId: null,
    gender: null,
    year: "sophomore" as const,
    phone: "555-123-4567",
    email: "morefie3@msu.edu",
    igHandle: null,
    memberStatus: null,
    newsletter: true,
    groupme: true,
    contactedViaIg: false,
    primaryContact: null,
    goals: null,
    notes: null,
    courseMaterial: ["ERT"],
    invitedByStudentId: 9,
    invitedByStaffId: null,
    eventInvitedToId: null,
    ledToChristByStudentId: 4,
    ledToChristByStaffId: null,
    salvationDecisionAt: null,
    salvationDecisionType: "lordship" as const,
    salvationDecisionNotes: "Follow-up",
    invitedByLabel: "Sam",
    ledToChristByLabel: "Jordan",
    eventInvitedToLabel: null,
  };

  it("combines blank fields and flags additively", () => {
    const preview = buildMergePreview(keep, merge);
    expect(preview.values.phone).toBe("555-123-4567");
    expect(preview.values.email).toBe("old@msu.edu");
    expect(preview.values.newsletter).toBe(true);
    expect(preview.values.groupme).toBe(true);
    expect(preview.values.year).toBe("sophomore");
    expect(preview.values.courseMaterial).toEqual(["Course 101", "ERT"]);
  });

  it("marks editable conflicts and applies overrides", () => {
    const preview = buildMergePreview(keep, merge, { email: "morefie3@msu.edu" });
    const emailField = preview.fields.find((field) => field.key === "email");
    expect(emailField?.conflict).toBe(true);
    expect(emailField?.editable).toBe(true);
    expect(preview.values.email).toBe("morefie3@msu.edu");
  });

  it("merges invite, salvation, and led-to-christ fields from the student page", () => {
    const preview = buildMergePreview(keep, merge);
    expect(preview.values.invitedByStaffId).toBe(3);
    expect(preview.values.invitedByStudentId).toBeNull();
    expect(preview.values.eventInvitedToId).toBe(10);
    expect(preview.values.ledToChristByStudentId).toBe(4);
    expect(preview.values.salvationDecisionAt).toEqual(new Date(Date.UTC(2026, 0, 5)));
    expect(preview.values.salvationDecisionType).toBe("salvation");
    expect(preview.values.salvationDecisionNotes).toContain("At retreat");
    expect(preview.values.salvationDecisionNotes).toContain("Follow-up");

    expect(preview.fields.some((f) => f.key === "invitedBy" && f.conflict)).toBe(true);
    expect(preview.fields.some((f) => f.key === "salvationDecisionType" && f.conflict)).toBe(true);
    expect(preview.fields.some((f) => f.key === "ledToChristBy")).toBe(true);
    expect(preview.fields.some((f) => f.key === "eventInvitedToId")).toBe(true);
  });

  it("clears person refs that point at the merged-away student", () => {
    const preview = buildMergePreview(
      { ...keep, invitedByStudentId: 2, invitedByStaffId: null, invitedByLabel: "Dup" },
      merge
    );
    expect(preview.values.invitedByStudentId).toBeNull();
    expect(preview.values.invitedByStaffId).toBeNull();
  });
});
