import { describe, expect, it } from "vitest";
import {
  countEmailLines,
  detectBulkFlags,
  extractEmailRosterEntriesFromText,
  extractNamesFromBulkText,
  normalizeBatchStudentsInput,
  shouldParseEmailRosterLocally,
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

  it("parses tab-separated email rosters with newsletter bulk flag", () => {
    const text = `Add subscribed to newsletter (and update email) for the following students:

morefie3@msu.edu\tNyah Morefield
shawtaky@msu.edu\tTakyra Shaw
crossja9@msu.edu\tJack Cross`;

    expect(shouldParseEmailRosterLocally(text)).toBe(true);
    expect(countEmailLines(text)).toBe(3);

    const result = normalizeBatchStudentsInput(text, [], roster);
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.newsletter === true)).toBe(true);
    expect(result[0]).toMatchObject({
      firstName: "Nyah",
      lastName: "Morefield",
      email: "morefie3@msu.edu",
      newsletter: true,
    });
    expect(result[2]).toMatchObject({
      firstName: "Jack",
      lastName: "Cross",
      email: "crossja9@msu.edu",
      newsletter: true,
    });
  });

  it("uses roster names when the pasted email roster line has no name", () => {
    const rosterWithEmail = [
      {
        id: 10,
        firstName: "Michael",
        lastName: "James",
        igHandle: null,
        phone: null,
        email: "mj003@msu.edu",
      },
    ];
    const text = `Add subscribed to newsletter for the following students:
mj003@msu.edu\t
morefie3@msu.edu\tNyah Morefield`;

    const result = normalizeBatchStudentsInput(text, [], rosterWithEmail);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      firstName: "Michael",
      lastName: "James",
      email: "mj003@msu.edu",
      newsletter: true,
    });
  });

  it("deduplicates repeated emails in an email roster paste", () => {
    const entries = extractEmailRosterEntriesFromText(
      "segresta@msu.edu\tArianna Segresta\nariannasegrest1@gmail.com\tArianna Segrest",
      roster
    );
    expect(entries).toHaveLength(2);
  });
});
