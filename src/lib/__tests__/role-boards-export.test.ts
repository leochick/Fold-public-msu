import { describe, expect, it } from "vitest";
import {
  buildRoleAssignmentRows,
  buildRoleBoardTableRows,
  buildRoleBoardWorkbook,
  buildWorkTeamGroups,
  excelFillForRoleColor,
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
        groupName: "Large Group",
        responsibilities: ["Opens the night"],
        color: "#93c5fd",
        people: [
          { entity: "staff", id: 1, firstName: "Sam", lastName: "Leader" },
          { entity: "student", id: 2, firstName: "Jane", lastName: "Doe" },
        ],
      },
      {
        name: "Sound",
        groupName: "Tech",
        responsibilities: [],
        color: "#f9a8d4",
        people: [{ entity: "staff", id: 3, firstName: "Min", lastName: null }, null],
      },
      {
        name: "",
        groupName: "Tech",
        responsibilities: [],
        color: "#f9a8d4",
        people: [null, null],
      },
    ],
  };

  it("builds table and assignment rows", () => {
    expect(buildRoleBoardTableRows(snapshot)).toEqual([
      {
        role: "Large Group - Emcee",
        groupName: "Large Group",
        responsibilities: "Opens the night",
        color: "#93c5fd",
        people: "Sam Leader, Jane Doe",
      },
      {
        role: "Tech - Sound",
        groupName: "Tech",
        responsibilities: "",
        color: "#f9a8d4",
        people: "Min",
      },
      {
        role: "Tech - Untitled role 3",
        groupName: "Tech",
        responsibilities: "",
        color: "#f9a8d4",
        people: "",
      },
    ]);

    expect(buildRoleAssignmentRows(snapshot)).toEqual([
      {
        role: "Large Group - Emcee",
        responsibilities: "Opens the night",
        person: "Sam Leader",
        type: "Staff",
        column: 1,
      },
      {
        role: "Large Group - Emcee",
        responsibilities: "Opens the night",
        person: "Jane Doe",
        type: "Student",
        column: 2,
      },
      {
        role: "Tech - Sound",
        responsibilities: "",
        person: "Min",
        type: "Staff",
        column: 1,
      },
    ]);
  });

  it("groups contiguous subheaders for work teams layout", () => {
    expect(buildWorkTeamGroups(snapshot)).toEqual([
      {
        name: "Large Group",
        color: "#93c5fd",
        roles: [{ role: "Emcee", people: "Sam Leader, Jane Doe" }],
      },
      {
        name: "Tech",
        color: "#f9a8d4",
        roles: [
          { role: "Sound", people: "Min" },
          { role: "Untitled role 3", people: "" },
        ],
      },
    ]);
  });

  it("maps pastel UI colors to saturated Excel fills", () => {
    expect(excelFillForRoleColor("#93c5fd")).toBe("FF6FA8DC");
    expect(excelFillForRoleColor("#f9a8d4")).toBe("FFC27BA0");
    expect(excelFillForRoleColor("#fdba74")).toBe("FFB45F06");
    expect(excelFillForRoleColor("#38761d")).toBe("FF666666");
  });

  it("resolves people from options", () => {
    const rows = resolveRoleBoardExportRows(
      [
        {
          name: "Host",
          groupName: "Events",
          responsibilities: [],
          color: "#e5e7eb",
          people: [{ entity: "staff", id: 9 }, null],
        },
      ],
      2,
      [{ entity: "staff", id: 9, firstName: "Pat", lastName: "Helper" }]
    );

    expect(rows[0]).toMatchObject({
      name: "Host",
      groupName: "Events",
      people: [
        { entity: "staff", id: 9, firstName: "Pat", lastName: "Helper" },
        null,
      ],
    });
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
    expect(rolesResp!.getCell("C1").value).toBe("RESPONSIBILITIES");
    expect(rolesResp!.getCell("A2").value).toBe("Fall 2025");
    expect(rolesResp!.getCell("A3").value).toBe("LARGE GROUP");
    expect(rolesResp!.getCell("A3").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9EAD3" },
    });
    expect(rolesResp!.getCell("A4").value).toBe("Emcee");
    expect(rolesResp!.getCell("B4").value).toBe("Sam Leader, Jane Doe");
    expect(rolesResp!.getCell("C4").value).toBe("Opens the night");
    expect(rolesResp!.getCell("A1").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF93C47D" },
    });
    // Role body cells stay unfilled — pastels are not used on xlsx body rows.
    expect(rolesResp!.getCell("A4").fill).toBeUndefined();

    const workTeams = workbook.getWorksheet("Roles & Work Teams");
    expect(workTeams).toBeTruthy();
    // Category band uses saturated ops colors (not UI pastels).
    expect(workTeams!.getCell("A1").value).toBe("LARGE GROUP");
    expect(workTeams!.getCell("A1").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6FA8DC" },
    });
    expect(workTeams!.getCell("C1").value).toBe("TECH");
    expect(workTeams!.getCell("C1").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC27BA0" },
    });
    // Dark green team headers.
    expect(workTeams!.getCell("A2").value).toBe("Large Group");
    expect(workTeams!.getCell("A2").fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF38761D" },
    });
    expect(workTeams!.getCell("C2").value).toBe("Tech");
    expect(workTeams!.getCell("A3").value).toBe("Emcee");
    expect(workTeams!.getCell("B3").value).toBe("Sam Leader, Jane Doe");
    expect(workTeams!.getCell("C3").value).toBe("Sound");
    expect(workTeams!.getCell("D3").value).toBe("Min");
    expect(workTeams!.getCell("C4").value).toBe("Untitled role 3");
    expect(workTeams!.getCell("A3").fill).toBeUndefined();

    expect(roleBoardExportFilename(snapshot.viewName)).toMatch(
      /^Roles-Fall-2025-\d{4}-\d{2}-\d{2}\.xlsx$/
    );
  });

  it("turns responsibility URLs into hyperlinks on RolesResp", async () => {
    const withLink: RoleBoardExportSnapshot = {
      ...snapshot,
      rows: [
        {
          name: "Venue",
          groupName: null,
          responsibilities: ["https://example.com/venues"],
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
