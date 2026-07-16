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
        people: "Sam Leader, Jane Doe",
      },
      {
        role: "Untitled role 2",
        description: "",
        color: "#e5e7eb",
        people: "",
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

  it("builds a workbook styled like the operations Roles sheets", async () => {
    const workbook = await buildRoleBoardWorkbook(snapshot);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "RolesResp",
      "Roles & Work Teams",
    ]);

    const rolesResp = workbook.getWorksheet("RolesResp");
    expect(rolesResp).toBeTruthy();
    expect(rolesResp!.getCell("A1").value).toBe("ROLES & RESPONSIBILITIES");
    expect(rolesResp!.getCell("C1").value).toBe("DESCRIPTION");
    expect(rolesResp!.getCell("A2").value).toBe("Fall 2025");
    expect(rolesResp!.getCell("A3").value).toBe("Emcee");
    expect(rolesResp!.getCell("B3").value).toBe("Sam Leader, Jane Doe");
    expect(rolesResp!.getCell("C3").value).toBe("Opens the night");
    expect(rolesResp!.getCell("A1").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF93C47D" },
    });
    expect(rolesResp!.getCell("A3").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF93C5FD" },
    });

    const workTeams = workbook.getWorksheet("Roles & Work Teams");
    expect(workTeams).toBeTruthy();
    expect(workTeams!.getCell("A1").value).toBe("ROLES & WORK TEAMS");
    expect(workTeams!.getCell("B1").value).toBe("Fall 2025");
    expect(workTeams!.getCell("A2").value).toBe("Role");
    expect(workTeams!.getCell("B2").value).toBe("People");
    expect(workTeams!.getCell("A3").value).toBe("Emcee");
    expect(workTeams!.getCell("B3").value).toBe("Sam Leader, Jane Doe");
    expect(workTeams!.getCell("A1").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF38761D" },
    });

    expect(roleBoardExportFilename(snapshot.viewName)).toMatch(
      /^Roles-Fall-2025-\d{4}-\d{2}-\d{2}\.xlsx$/
    );
  });

  it("turns description URLs into hyperlinks on RolesResp", async () => {
    const withLink: RoleBoardExportSnapshot = {
      ...snapshot,
      rows: [
        {
          name: "Venue",
          description: "https://example.com/venues",
          color: "#86efac",
          people: [{ entity: "staff", id: 3, firstName: "Chris", lastName: "Chen" }],
        },
      ],
    };

    const workbook = await buildRoleBoardWorkbook(withLink);
    const cell = workbook.getWorksheet("RolesResp")!.getCell("C3");
    expect(cell.value).toEqual({
      text: "https://example.com/venues",
      hyperlink: "https://example.com/venues",
    });
  });
});
