import { describe, expect, it } from "vitest";
import {
  countEmailLines,
  countSalvationDecisionLines,
  detectBulkFlags,
  extractEmailRosterEntriesFromText,
  extractNameListBodyLines,
  extractNamesFromBulkText,
  extractSalvationDecisionEntriesFromText,
  normalizeBatchStudentsInput,
  parseFlexibleIsoDate,
  parseSalvationDecisionType,
  shouldParseBulkListLocally,
  shouldParseEmailRosterLocally,
  shouldParseSalvationDecisionLocally,
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

  it("parses newline-separated name lists with groupme bulk flag", () => {
    const groupmeRoster = [
      { id: 1, firstName: "Amar", lastName: "Jain", igHandle: null, phone: null, email: null },
      { id: 2, firstName: "Takyra", lastName: "Shaw", igHandle: null, phone: null, email: null },
      { id: 3, firstName: "William", lastName: "Yang", igHandle: null, phone: null, email: null },
      { id: 4, firstName: "Michael", lastName: "James", igHandle: null, phone: null, email: null },
    ];
    const text = `Mark Groupme for the following students:

Amar Jain
Takyra Shaw
William Yang
MJ`;

    expect(shouldParseBulkListLocally(text)).toBe(true);
    expect(extractNameListBodyLines(text)).toEqual([
      "Amar Jain",
      "Takyra Shaw",
      "William Yang",
      "MJ",
    ]);

    const result = normalizeBatchStudentsInput(text, [], groupmeRoster);
    expect(result).toHaveLength(4);
    expect(result.every((s) => s.groupme === true)).toBe(true);
    expect(result[0]).toMatchObject({ firstName: "Amar", lastName: "Jain", groupme: true });
    expect(result[3]).toMatchObject({ firstName: "Michael", lastName: "James", groupme: true });
  });

  it("parses tab-separated salvation decision rosters locally", () => {
    const decisionRoster = [
      { id: 1, firstName: "Jayden", lastName: "Hawthorne", igHandle: null, phone: null, email: null },
      { id: 2, firstName: "Leo", lastName: "Alvarez", igHandle: null, phone: null, email: null },
      { id: 3, firstName: "Regina", lastName: "Carbajal", igHandle: null, phone: null, email: null },
      { id: 4, firstName: "Arianna", lastName: "Segresta", igHandle: null, phone: null, email: null },
      { id: 5, firstName: "Nolan", lastName: "Smith", igHandle: null, phone: null, email: null },
    ];
    const text = `Add Salvation Decision Date, Salvation Decision Type, and Salvation Decision Notes for the following people:

Jayden Hawthorne\t9/27/25\tSalvation\tFall Retreat
Leo Alvarez\t10/8/25\tSalvation\tCourse 101
Regina Carbajal\t10/9/25\tLordship\tCourse 101
Arianna\t4/8/26\tSalvation\tCourse 101
Nolan\t4/16/26\tSalvation\tConversation`;

    expect(shouldParseSalvationDecisionLocally(text)).toBe(true);
    expect(shouldParseBulkListLocally(text)).toBe(true);
    expect(countSalvationDecisionLines(text)).toBe(5);

    const result = normalizeBatchStudentsInput(text, [], decisionRoster);
    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      firstName: "Jayden",
      lastName: "Hawthorne",
      salvationDecisionAt: "2025-09-27",
      salvationDecisionType: "salvation",
      salvationDecisionNotes: "Fall Retreat",
    });
    expect(result[2]).toMatchObject({
      firstName: "Regina",
      lastName: "Carbajal",
      salvationDecisionAt: "2025-10-09",
      salvationDecisionType: "lordship",
      salvationDecisionNotes: "Course 101",
    });
    expect(result[3]).toMatchObject({
      firstName: "Arianna",
      lastName: "Segresta",
      salvationDecisionAt: "2026-04-08",
      salvationDecisionType: "salvation",
      salvationDecisionNotes: "Course 101",
    });
    expect(result[4]).toMatchObject({
      firstName: "Nolan",
      lastName: "Smith",
      salvationDecisionAt: "2026-04-16",
      salvationDecisionType: "salvation",
      salvationDecisionNotes: "Conversation",
    });
  });

  it("parses space-separated salvation decision lines without tabs", () => {
    const entries = extractSalvationDecisionEntriesFromText(
      "Katie Dunn 4/1/26 Salvation Course 101\nTakyra Shaw 4/6/26 Salvation Course 101",
      [
        { id: 1, firstName: "Katie", lastName: "Dunn", igHandle: null, phone: null, email: null },
        { id: 2, firstName: "Takyra", lastName: "Shaw", igHandle: null, phone: null, email: null },
      ]
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      firstName: "Katie",
      lastName: "Dunn",
      salvationDecisionAt: "2026-04-01",
      salvationDecisionType: "salvation",
      salvationDecisionNotes: "Course 101",
    });
  });

  it("parses the full salvation decision example roster", () => {
    const text = `Add Salvation Decision Date, Salvation Decision Type, and Salvation Decision Notes for the following people:

Jayden Hawthorne	9/27/25	Salvation	Fall Retreat
Leo Alvarez	10/8/25	Salvation	Course 101
Jamil Mamun	10/9/25	Salvation	Conversation
Regina Carbajal	10/9/25	Lordship	Course 101
Sama Joseph	10/15/25	Salvation	Course 101
Joey Badalamenti	10/16/25	Salvation	DH Convo
Lizbeth Jaimes	11/13/25	Lordship	Course 101
Lauren Wright	12/11/25	Salvation	Course 101
Ben McNally	3/15/26	Salvation	Conversation
Ciara Finch	3/18/26	Lordship	Course 101
Katie Dunn	4/1/26	Salvation	Course 101
Takyra Shaw	4/6/26	Salvation	Course 101
Arianna	4/8/26	Salvation	Course 101
Geremiah Toler	4/15/26	Salvation	Conversation
Nolan	4/16/26	Salvation	Conversation
Emmanuel McAfee	4/16/26	Lordship	Course 101
Anthony	4/24/26	Salvation	ERT Convo`;

    const result = normalizeBatchStudentsInput(text, []);
    expect(result).toHaveLength(17);
    expect(result.filter((s) => s.salvationDecisionType === "lordship")).toHaveLength(4);
    expect(result.find((s) => s.firstName === "Anthony")).toMatchObject({
      salvationDecisionAt: "2026-04-24",
      salvationDecisionType: "salvation",
      salvationDecisionNotes: "ERT Convo",
    });
  });
});

describe("parseFlexibleIsoDate / parseSalvationDecisionType", () => {
  it("converts slash dates and decision type labels", () => {
    expect(parseFlexibleIsoDate("9/27/25")).toBe("2025-09-27");
    expect(parseFlexibleIsoDate("10/8/2025")).toBe("2025-10-08");
    expect(parseFlexibleIsoDate("2026-04-16")).toBe("2026-04-16");
    expect(parseFlexibleIsoDate("not-a-date")).toBeNull();
    expect(parseSalvationDecisionType("Salvation")).toBe("salvation");
    expect(parseSalvationDecisionType("Lordship")).toBe("lordship");
    expect(parseSalvationDecisionType("other")).toBeNull();
  });
});
