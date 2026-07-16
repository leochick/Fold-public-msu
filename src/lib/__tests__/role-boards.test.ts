import { describe, expect, it } from "vitest";
import {
  contrastingTextColor,
  DEFAULT_ROLE_COLOR,
  formatResponsibilitiesTooltip,
  normalizeResponsibilities,
  normalizeRoleBoardRows,
  normalizeRoleColor,
  parsePersonKey,
  personKey,
  resolveRoleBoardRoleEntries,
  ROLE_COLOR_PALETTE,
} from "@/lib/role-boards";

describe("normalizeRoleBoardRows", () => {
  it("pads and trims people to personColumnCount", () => {
    const rows = normalizeRoleBoardRows(
      [
        {
          name: "Emcee",
          responsibilities: ["Opens the night", "Introduces speakers"],
          color: "#93c5fd",
          people: [
            { entity: "staff", id: 1 },
            { entity: "student", id: 2 },
            { entity: "staff", id: 3 },
          ],
        },
      ],
      2
    );

    expect(rows).toEqual([
      {
        kind: "role",
        name: "Emcee",
        responsibilities: ["Opens the night", "Introduces speakers"],
        color: "#93c5fd",
        people: [
          { entity: "staff", id: 1 },
          { entity: "student", id: 2 },
        ],
      },
    ]);
  });

  it("fills missing people with null and defaults responsibilities/color", () => {
    const rows = normalizeRoleBoardRows([{ name: "Host", people: [] }], 3);
    expect(rows[0]).toEqual({
      kind: "role",
      name: "Host",
      responsibilities: [],
      color: DEFAULT_ROLE_COLOR,
      people: [null, null, null],
    });
  });

  it("migrates legacy description strings into responsibilities", () => {
    const rows = normalizeRoleBoardRows(
      [
        {
          name: "Emcee",
          description: "Opens the night\n• Greets guests",
          people: [],
        },
      ],
      0
    );
    expect(rows[0].kind).toBe("role");
    if (rows[0].kind === "role") {
      expect(rows[0].responsibilities).toEqual(["Opens the night", "Greets guests"]);
    }
  });

  it("normalizes subheader rows", () => {
    const rows = normalizeRoleBoardRows(
      [
        { kind: "subheader", name: "Tech", color: "#93c5fd" },
        { name: "Sound", people: [] },
      ],
      0
    );
    expect(rows).toEqual([
      { kind: "subheader", name: "Tech", color: "#93c5fd" },
      {
        kind: "role",
        name: "Sound",
        responsibilities: [],
        color: DEFAULT_ROLE_COLOR,
        people: [],
      },
    ]);
  });

  it("returns empty for non-arrays", () => {
    expect(normalizeRoleBoardRows(null, 1)).toEqual([]);
  });
});

describe("resolveRoleBoardRoleEntries", () => {
  it("hyphenates display names and inherits subheader color", () => {
    const rows = normalizeRoleBoardRows(
      [
        { kind: "subheader", name: "Tech", color: "#93c5fd" },
        { name: "Sound", people: [] },
        { name: "Propre", people: [] },
        { kind: "subheader", name: "Hospitality", color: "#86efac" },
        { name: "Welcome", people: [] },
      ],
      0
    );
    const entries = resolveRoleBoardRoleEntries(rows);
    expect(entries.map((entry) => ({ name: entry.displayName, color: entry.color }))).toEqual([
      { name: "Tech - Sound", color: "#93c5fd" },
      { name: "Tech - Propre", color: "#93c5fd" },
      { name: "Hospitality - Welcome", color: "#86efac" },
    ]);
  });
});

describe("normalizeResponsibilities", () => {
  it("keeps array items and drops blanks", () => {
    expect(normalizeResponsibilities([" A ", "", "B"])).toEqual(["A", "B"]);
  });

  it("splits string responsibilities on newlines", () => {
    expect(normalizeResponsibilities("One\n- Two")).toEqual(["One", "Two"]);
  });
});

describe("formatResponsibilitiesTooltip", () => {
  it("returns undefined when empty", () => {
    expect(formatResponsibilitiesTooltip([])).toBeUndefined();
  });

  it("formats bullets for hover text", () => {
    expect(formatResponsibilitiesTooltip(["Opens", "Closes"])).toBe("• Opens\n• Closes");
  });
});

describe("normalizeRoleColor", () => {
  it("accepts palette colors and expands 3-digit matches", () => {
    expect(normalizeRoleColor("#93C5FD")).toBe("#93c5fd");
    expect(normalizeRoleColor(ROLE_COLOR_PALETTE[2])).toBe(ROLE_COLOR_PALETTE[2]);
  });

  it("falls back for invalid or off-palette values", () => {
    expect(normalizeRoleColor("red")).toBe(DEFAULT_ROLE_COLOR);
    expect(normalizeRoleColor("#ff0000")).toBe(DEFAULT_ROLE_COLOR);
    expect(normalizeRoleColor(null)).toBe(DEFAULT_ROLE_COLOR);
  });
});

describe("contrastingTextColor", () => {
  it("uses dark text on light palette colors", () => {
    expect(contrastingTextColor("#e5e7eb")).toBe("#111827");
    expect(contrastingTextColor("#fcd34d")).toBe("#111827");
  });
});

describe("personKey", () => {
  it("round-trips through parsePersonKey", () => {
    const person = { entity: "staff" as const, id: 9 };
    expect(parsePersonKey(personKey(person))).toEqual(person);
  });
});
