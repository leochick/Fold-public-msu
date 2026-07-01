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
    isActive: true,
    newsletter: false,
    groupme: false,
    contactedViaIg: false,
    primaryContact: null,
    goals: null,
    notes: "Keep notes",
    courseMaterial: ["Course 101"],
    funnelStage: "active" as const,
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
    isActive: true,
    newsletter: true,
    groupme: true,
    contactedViaIg: false,
    primaryContact: null,
    goals: null,
    notes: null,
    courseMaterial: ["ERT"],
    funnelStage: "connected" as const,
  };

  it("combines blank fields and flags additively", () => {
    const preview = buildMergePreview(keep, merge);
    expect(preview.values.phone).toBe("555-123-4567");
    expect(preview.values.email).toBe("old@msu.edu");
    expect(preview.values.newsletter).toBe(true);
    expect(preview.values.groupme).toBe(true);
    expect(preview.values.year).toBe("sophomore");
    expect(preview.values.courseMaterial).toEqual(["Course 101", "ERT"]);
    expect(preview.values.funnelStage).toBe("active");
  });

  it("marks editable conflicts and applies overrides", () => {
    const preview = buildMergePreview(keep, merge, { email: "morefie3@msu.edu" });
    const emailField = preview.fields.find((field) => field.key === "email");
    expect(emailField?.conflict).toBe(true);
    expect(emailField?.editable).toBe(true);
    expect(preview.values.email).toBe("morefie3@msu.edu");
  });
});
