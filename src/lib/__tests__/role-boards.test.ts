import { describe, expect, it } from "vitest";
import { normalizeRoleBoardRows, parsePersonKey, personKey } from "@/lib/role-boards";

describe("normalizeRoleBoardRows", () => {
  it("pads and trims people to personColumnCount", () => {
    const rows = normalizeRoleBoardRows(
      [
        {
          name: "Emcee",
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
        people: [
          { entity: "staff", id: 1 },
          { entity: "student", id: 2 },
        ],
      },
    ]);
  });

  it("fills missing people with null", () => {
    const rows = normalizeRoleBoardRows([{ name: "Host", people: [] }], 3);
    expect(rows[0].people).toEqual([null, null, null]);
  });

  it("returns empty for non-arrays", () => {
    expect(normalizeRoleBoardRows(null, 1)).toEqual([]);
  });
});

describe("personKey", () => {
  it("round-trips through parsePersonKey", () => {
    const person = { entity: "staff" as const, id: 9 };
    expect(parsePersonKey(personKey(person))).toEqual(person);
  });
});
