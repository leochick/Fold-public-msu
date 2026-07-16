import { describe, expect, it } from "vitest";
import {
  buildRoleAssignmentRows,
  buildRoleBoardTableRows,
  buildRoleBoardWorkbook,
  resolveRoleBoardExportRows,
  roleBoardExportFilename,
  type RoleBoardExportSnapshot,
} from "@/lib/role-boards-export";

describe("role board export", () => {
  const snapshot: RoleBoardExportSnapshot = {
    viewName: "Fall 2025",
    viewFrom: "2025-08-01",
    viewTo: "2025-12-15",
    personColumnCount: 2,
    rows: [
      {
        name: "Emcee",
        description: "Opens the night",
        color: "#93c5fd",
        people: [
          { entity: "staff", id: 1, firstName: "Sam", lastName: "Leader" },
          { entity: "student", id: 2, firstName: "Jane", lastName: "Doe" },
        ],
      },
      {
        name: "",
        description: "",
        color: "#e5e7eb",
        people: [null, null],
      },
    ],
  };

  it("builds table and assignment rows", () => {
    expect(buildRoleBoardTableRows(snapshot)).toEqual([
      {
        role: "Emcee",
        description: "Opens the night",
        color: "#93c5fd",
        people: ["Sam Leader (Staff)", "Jane Doe (Student)"],
      },
      {
        role: "Untitled role 2",
        description: "",
        color: "#e5e7eb",
        people: ["", ""],
      },
    ]);

    expect(buildRoleAssignmentRows(snapshot)).toEqual([
      {
        role: "Emcee",
        description: "Opens the night",
        person: "Sam Leader",
        type: "Staff",
        column: 1,
      },
      {
        role: "Emcee",
        description: "Opens the night",
        person: "Jane Doe",
        type: "Student",
        column: 2,
      },
    ]);
  });

  it("resolves people from options", () => {
    const rows = resolveRoleBoardExportRows(
      [
        {
          name: "Host",
          description: "",
          color: "#e5e7eb",
          people: [{ entity: "staff", id: 9 }, null],
        },
      ],
      2,
      [{ entity: "staff", id: 9, firstName: "Pat", lastName: "Helper" }]
    );

    expect(rows[0].people).toEqual([
      { entity: "staff", id: 9, firstName: "Pat", lastName: "Helper" },
      null,
    ]);
  });

  it("builds a workbook and filename", async () => {
    const workbook = await buildRoleBoardWorkbook(snapshot);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "Roles",
      "Assignments",
    ]);
    expect(roleBoardExportFilename(snapshot.viewName)).toMatch(/^Roles-Fall-2025-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
