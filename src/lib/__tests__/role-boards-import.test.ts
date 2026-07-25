import { describe, expect, it } from "vitest";
import {
  parseRoleBoardWorkbook,
  resolveImportPersonName,
  roleBoardRowsFromImportPreview,
  splitPeopleCell,
} from "@/lib/role-boards-import";
import { buildRoleBoardWorkbook, type RoleBoardExportSnapshot } from "@/lib/role-boards-export";

const personOptions = [
  { entity: "staff" as const, id: 1, firstName: "Corinne", lastName: "Chick" },
  { entity: "staff" as const, id: 2, firstName: "Leo", lastName: "Chick" },
  { entity: "student" as const, id: 3, firstName: "Madison", lastName: "Conner" },
  { entity: "staff" as const, id: 4, firstName: "Min", lastName: "Hyuk Choi" },
];

describe("splitPeopleCell", () => {
  it("splits comma-separated names", () => {
    expect(splitPeopleCell("Leo Chick, Madison Conner")).toEqual([
      "Leo Chick",
      "Madison Conner",
    ]);
  });
});

describe("resolveImportPersonName", () => {
  it("matches exact names and prefers staff on ties", () => {
    expect(resolveImportPersonName("Leo Chick", personOptions)).toMatchObject({
      status: "matched",
      person: { entity: "staff", id: 2 },
    });
  });

  it("marks unknown names unmatched", () => {
    expect(resolveImportPersonName("Nobody Here", personOptions).status).toBe("unmatched");
  });
});

describe("parseRoleBoardWorkbook", () => {
  it("round-trips a Fold RolesResp export into board rows", async () => {
    const snapshot: RoleBoardExportSnapshot = {
      viewName: "2026 Fall Semester",
      viewFrom: "2026-08-20",
      viewTo: "2026-12-11",
      personColumnCount: 2,
      rows: [
        {
          name: "Onestop Manager",
          groupName: "Admin",
          responsibilities: ["Keep MSU Onestop updated"],
          color: "#93c5fd",
          people: [
            { entity: "staff", id: 1, firstName: "Corinne", lastName: "Chick" },
            null,
          ],
        },
        {
          name: "Venues",
          groupName: "Event",
          responsibilities: [],
          color: "#fdba74",
          people: [
            { entity: "staff", id: 2, firstName: "Leo", lastName: "Chick" },
            { entity: "student", id: 3, firstName: "Madison", lastName: "Conner" },
          ],
        },
        {
          name: "Tech Lead",
          groupName: "Tech",
          responsibilities: ["Own the stack"],
          color: "#86efac",
          people: [{ entity: "staff", id: 4, firstName: "Min", lastName: "Hyuk Choi" }, null],
        },
      ],
    };

    const workbook = await buildRoleBoardWorkbook(snapshot);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const preview = await parseRoleBoardWorkbook(buffer, personOptions);

    expect(preview.sourceLabel).toBe("2026 Fall Semester");
    expect(preview.roleCount).toBe(3);
    expect(preview.groupCount).toBe(3);
    expect(preview.matchedPeople).toBe(4);
    expect(preview.unmatchedPeople).toBe(0);
    expect(preview.personColumnCount).toBe(2);

    const { rows, personColumnCount } = roleBoardRowsFromImportPreview(preview);
    expect(personColumnCount).toBe(2);
    expect(rows).toEqual([
      { kind: "subheader", name: "ADMIN", color: expect.any(String) },
      {
        kind: "role",
        name: "Onestop Manager",
        responsibilities: ["Keep MSU Onestop updated"],
        color: expect.any(String),
        people: [{ entity: "staff", id: 1 }, null],
      },
      { kind: "subheader", name: "EVENT", color: expect.any(String) },
      {
        kind: "role",
        name: "Venues",
        responsibilities: [],
        color: expect.any(String),
        people: [
          { entity: "staff", id: 2 },
          { entity: "student", id: 3 },
        ],
      },
      { kind: "subheader", name: "TECH", color: expect.any(String) },
      {
        kind: "role",
        name: "Tech Lead",
        responsibilities: ["Own the stack"],
        color: expect.any(String),
        people: [{ entity: "staff", id: 4 }, null],
      },
    ]);
  });
});
