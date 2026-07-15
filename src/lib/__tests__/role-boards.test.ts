import { describe, expect, it } from "vitest";
import {
  contrastingTextColor,
  DEFAULT_ROLE_COLOR,
  normalizeRoleBoardRows,
  normalizeRoleColor,
  parsePersonKey,
  personKey,
} from "@/lib/role-boards";

describe("normalizeRoleBoardRows", () => {
  it("pads and trims people to personColumnCount", () => {
    const rows = normalizeRoleBoardRows(
      [
        {
          name: "Emcee",
          description: "Opens the night",
          color: "#ff0000",
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
        color: "#ff0000",
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
  it("accepts 6-digit hex and expands 3-digit", () => {
    expect(normalizeRoleColor("#AbCdEf")).toBe("#abcdef");
    expect(normalizeRoleColor("#abc")).toBe("#aabbcc");
  });

  it("falls back for invalid values", () => {
    expect(normalizeRoleColor("red")).toBe(DEFAULT_ROLE_COLOR);
    expect(normalizeRoleColor(null)).toBe(DEFAULT_ROLE_COLOR);
  });
});

describe("contrastingTextColor", () => {
  it("uses dark text on light backgrounds and light text on dark", () => {
    expect(contrastingTextColor("#ffffff")).toBe("#111827");
    expect(contrastingTextColor("#000000")).toBe("#ffffff");
  });
});

describe("personKey", () => {
  it("round-trips through parsePersonKey", () => {
    const person = { entity: "staff" as const, id: 9 };
    expect(parsePersonKey(personKey(person))).toEqual(person);
  });
});
