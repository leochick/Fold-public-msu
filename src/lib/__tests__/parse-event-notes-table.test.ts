import { describe, expect, test } from "vitest";
import { parseEventNotesTable, looksLikeEventNotesTable } from "../parse-event-notes-table";

describe("parseEventNotesTable", () => {
  test("detects Event/Notes header after preamble", () => {
    const text = `Add the following "notes" for these events:\n\nEvent\tNotes\nSnowfest\tLucas, Madi`;
    expect(looksLikeEventNotesTable(text)).toBe(true);
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
