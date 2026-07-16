import { describe, expect, it } from "vitest";
import {
  contrastingTextColor,
  DEFAULT_ROLE_COLOR,
  normalizeRoleBoardRows,
  normalizeRoleColor,
  parsePersonKey,
  personKey,
  ROLE_COLOR_PALETTE,
} from "@/lib/role-boards";

describe("normalizeRoleBoardRows", () => {
  it("pads and trims people to personColumnCount", () => {
    const rows = normalizeRoleBoardRows(
      [
        {
          name: "Emcee",
          description: "Opens the night",
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
        name: "Emcee",
        description: "Opens the night",
        color: "#93c5fd",
        people: [
          { entity: "staff", id: 1 },
          { entity: "student", id: 2 },
        ],
      },
    ]);
  });

  it("fills missing people with null and defaults description/color", () => {
    const rows = normalizeRoleBoardRows([{ name: "Host", people: [] }], 3);
    expect(rows[0]).toEqual({
      name: "Host",
      description: "",
      color: DEFAULT_ROLE_COLOR,
      people: [null, null, null],
    });
  });

  it("returns empty for non-arrays", () => {
    expect(normalizeRoleBoardRows(null, 1)).toEqual([]);
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
