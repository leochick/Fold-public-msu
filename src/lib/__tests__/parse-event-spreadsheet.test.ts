import { describe, expect, test } from "vitest";
import {
  looksLikeEventNotesTable,
  looksLikeEventCreateTable,
  parseEventNotesTable,
  parseEventCreateTable,
  parseSpreadsheetDate,
  parseAttendance,
} from "../parse-event-spreadsheet";

describe("parseEventNotesTable", () => {
  test("detects Event/Notes header after preamble", () => {
    const text = `Add the following "notes" for these events:\n\nEvent\tNotes\nSnowfest\tLucas, Madi`;
    expect(looksLikeEventNotesTable(text)).toBe(true);
    expect(looksLikeEventCreateTable(text)).toBe(false);
  });

  test("parses simple tab-separated rows", () => {
    const text = `Event\tNotes\nSnowfest\tLucas, Madi\nVDOC\tMadi, Jill (her birthday!)`;
    expect(parseEventNotesTable(text)).toEqual([
      { name: "Snowfest", notes: "Lucas, Madi" },
      { name: "VDOC", notes: "Madi, Jill (her birthday!)" },
    ]);
  });

  test("parses quoted multiline notes and titles", () => {
    const text = [
      "Event\tNotes",
      'D-Group\t"Life Journeys / F&F - Word',
      "",
      'Jamil, Joe, Cam"',
      '"Anchor Large Group:',
      'Jesus: Dead or Alive?"\t"Despite rain',
      '68 students"',
      "Sis Night\t",
    ].join("\n");

    const rows = parseEventNotesTable(text);
    expect(rows).toEqual([
      {
        name: "D-Group",
        notes: "Life Journeys / F&F - Word\n\nJamil, Joe, Cam",
      },
      {
        name: "Anchor Large Group:\nJesus: Dead or Alive?",
        notes: "Despite rain\n68 students",
      },
      { name: "Sis Night", notes: "" },
    ]);
  });

  test("returns null when no header", () => {
    expect(parseEventNotesTable("create weekly 5/1")).toBeNull();
    expect(looksLikeEventNotesTable("create weekly 5/1")).toBe(false);
  });
});

describe("parseSpreadsheetDate", () => {
  // Jul 23, 2026 — used so weekday disambiguation can prefer Fall 2025.
  const today = new Date(2026, 6, 23);

  test("parses weekday + M/D using matching year", () => {
    // Aug 22, 2025 was a Friday; Aug 22, 2026 is a Saturday.
    expect(parseSpreadsheetDate("Friday, 8/22", today)).toBe("2025-08-22");
    expect(parseSpreadsheetDate("Saturday, 10/11", today)).toBe("2025-10-11");
  });

  test("uses start of a date range", () => {
    expect(parseSpreadsheetDate("Friday, 9/26 - Sunday, 9/28", today)).toBe("2025-09-26");
  });

  test("respects explicit year", () => {
    expect(parseSpreadsheetDate("8/22/2024", today)).toBe("2024-08-22");
  });

  test("defaults to current year without weekday", () => {
    expect(parseSpreadsheetDate("8/22", today)).toBe("2026-08-22");
  });
});

describe("parseAttendance", () => {
  test("parses plain counts and sums", () => {
    expect(parseAttendance("52")).toBe(52);
    expect(parseAttendance("37 + 2")).toBe(39);
    expect(parseAttendance("25 (21+4)")).toBe(25);
    expect(parseAttendance("18 --> 9?")).toBe(18);
    expect(parseAttendance("")).toBeUndefined();
  });
});

describe("parseEventCreateTable", () => {
  const today = new Date(2026, 6, 23);

  test("detects Date/Event header after preamble", () => {
    const text = `Add the following events:\n\nDate\tEvent\tLocation\tAttendance\tNotes\nFriday, 8/22\tOpen House\tMCC\t52\t`;
    expect(looksLikeEventCreateTable(text)).toBe(true);
    expect(looksLikeEventNotesTable(text)).toBe(false);
  });

  test("parses create rows with attendance, location, and multiline notes", () => {
    const text = [
      "Add the following events data from the following events:",
      "",
      "Date\tEvent\tLocation\tAttendance\tNotes",
      "Friday, 8/22 \tOpen House\tMCC\t52\t",
      "Saturday, 8/23 \tWelcome Night\tMSU Union\t78\t",
      'Friday, 8/29 \tAnchor Friday\tHunter\'s Ridge\t10\t"Labor Day Weekend, 1st game, at our home',
      "",
      'If Friday game again, maybe we should do tailgate on campus"',
      "Friday, 9/26 - Sunday, 9/28\tFall Retreat\tMichindoh Conference Center\t3\tRip was sick",
      "Thursday, 11/20 \tFriendsgiving\tMSU Union\t37 + 2\tAt least 11 brand-new ppl",
    ].join("\n");

    const rows = parseEventCreateTable(text, { today });
    expect(rows).toEqual([
      { name: "Open House", date: "2025-08-22", location: "MCC", totalStudents: 52 },
      {
        name: "Welcome Night",
        date: "2025-08-23",
        location: "MSU Union",
        totalStudents: 78,
      },
      {
        name: "Anchor Friday",
        date: "2025-08-29",
        location: "Hunter's Ridge",
        totalStudents: 10,
        notes:
          "Labor Day Weekend, 1st game, at our home\n\nIf Friday game again, maybe we should do tailgate on campus",
      },
      {
        name: "Fall Retreat",
        date: "2025-09-26",
        location: "Michindoh Conference Center",
        totalStudents: 3,
        notes: "Rip was sick",
      },
      {
        name: "Friendsgiving",
        date: "2025-11-20",
        location: "MSU Union",
        totalStudents: 39,
        notes: "At least 11 brand-new ppl",
      },
    ]);
  });

  test("parses the full semester paste shape without dropping rows", () => {
    const text = `Date\tEvent\tLocation\tAttendance\tNotes
Friday, 8/22 \tOpen House\tMCC\t52\t
Tuesday, 8/26 \tBros, Bible, Ball\tBrody\t1\t
Tuesday, 8/26 \tFlourish Women's Group\tHunter's Ridge\t2\t
Thursday, 11/13 \tAnchor Large Group (John 6A) + Broomball\tWells --> Munn Ice Stadium\t25 (21+4)\tEven though ppl stressed
Friday, 12/5\tStudy Hall\tHR\t4\tJamil, Joe, Chaz, Jill`;

    const rows = parseEventCreateTable(text, { today });
    expect(rows).toHaveLength(5);
    expect(rows![0]).toMatchObject({ name: "Open House", date: "2025-08-22", totalStudents: 52 });
    expect(rows![3]).toMatchObject({
      name: "Anchor Large Group (John 6A) + Broomball",
      location: "Wells --> Munn Ice Stadium",
      totalStudents: 25,
    });
    expect(rows![4]).toMatchObject({ name: "Study Hall", date: "2025-12-05", totalStudents: 4 });
  });

  test("keeps nested quotes inside Friendsgiving-style notes", () => {
    const text = [
      "Date\tEvent\tLocation\tAttendance\tNotes",
      'Thursday, 11/20 \tFriendsgiving\tMSU Union\t37 + 2\t"Caleb (6th hr)',
      "",
      '""At least 11 brand-new ppl',
      "",
      'At least 5 of these ppl were 6th hour contacts"""',
    ].join("\n");

    const rows = parseEventCreateTable(text, { today });
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({
      name: "Friendsgiving",
      date: "2025-11-20",
      totalStudents: 39,
    });
    expect(rows![0].notes).toContain('"At least 11 brand-new ppl');
    expect(rows![0].notes).toContain("6th hour contacts");
  });
});
