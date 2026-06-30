import { describe, expect, it } from "vitest";
import {
  detectBulkFlags,
  extractNamesFromBulkText,
  normalizeBatchStudentsInput,
} from "../parse-students-batch-normalize";

const roster = [
  { id: 1, firstName: "Caleb", lastName: "Adams", igHandle: null, phone: null, email: null },
  { id: 2, firstName: "Rip", lastName: null, igHandle: null, phone: null, email: null },
  { id: 3, firstName: "Katie", lastName: "Lee", igHandle: null, phone: null, email: null },
];

describe("detectBulkFlags", () => {
  it("detects newsletter subscribe intent", () => {
    expect(detectBulkFlags("Mark subscribed to newsletter for: Caleb, Rip")).toEqual({
      newsletter: true,
    });
  });

  it("detects newsletter unsubscribe intent", () => {
    expect(detectBulkFlags("Mark not on newsletter for: Caleb")).toEqual({
      newsletter: false,
    });
  });

  it("detects groupme intent", () => {
    expect(detectBulkFlags("Add to Groupme: Maya, Jordan")).toEqual({
      groupme: true,
    });
  });
});

describe("extractNamesFromBulkText", () => {
  it("parses names after for:", () => {
    expect(extractNamesFromBulkText("Mark newsletter for: Caleb, Rip, Katie")).toEqual([
      { firstName: "Caleb", rawText: "Caleb" },
      { firstName: "Rip", rawText: "Rip" },
      { firstName: "Katie", rawText: "Katie" },
    ]);
  });

  it("matches roster names mentioned in free text", () => {
    expect(extractNamesFromBulkText("Caleb Adams and Rip subscribed to newsletter", roster)).toEqual([
      { firstName: "Caleb", lastName: "Adams", rawText: "Caleb Adams" },
      { firstName: "Rip", rawText: "Rip" },
    ]);
  });
});

describe("normalizeBatchStudentsInput", () => {
  it("builds student entries when AI returns an empty array", () => {
    const result = normalizeBatchStudentsInput(
      "Mark subscribed to newsletter for: Caleb, Rip, Katie",
      [],
      roster
    );
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.newsletter === true)).toBe(true);
    expect(result.map((s) => s.firstName)).toEqual(["Caleb", "Rip", "Katie"]);
  });

  it("applies bulk flags when AI returns names without newsletter", () => {
    const result = normalizeBatchStudentsInput(
      "Mark subscribed to newsletter for: Caleb, Rip",
      [{ firstName: "Caleb", rawText: "Caleb" }, { firstName: "Rip", rawText: "Rip" }],
      roster
    );
    expect(result.every((s) => s.newsletter === true)).toBe(true);
  });

  it("extracts contact info when AI returns an empty array", () => {
    const result = normalizeBatchStudentsInput(
      "Caleb Adams - 555-123-4567, caleb@example.com",
      [],
      roster
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      firstName: "Caleb",
      lastName: "Adams",
      phone: "555-123-4567",
      email: "caleb@example.com",
    });
  });

  it("enriches AI names with contact info from the same line", () => {
    const result = normalizeBatchStudentsInput(
      "Rip - rip@msu.edu",
      [{ firstName: "Rip", rawText: "Rip - rip@msu.edu" }],
      roster
    );
    expect(result[0]?.email).toBe("rip@msu.edu");
  });
});
