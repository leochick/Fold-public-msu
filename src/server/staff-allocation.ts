import { db } from "@/lib/db";
import { groupings, students } from "../../drizzle/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { normalizeGroupingContainers } from "@/lib/grouping-containers";
import type { GroupingStudentStatus } from "@/lib/grouping-status";
import { getAllStaff, getStudentsForView } from "@/server/groupings";
import { getRoleBoardByViewId } from "@/server/roles";
import { anthropic, HAIKU, STAFF_ALLOCATION_INSIGHTS_TOOL } from "@/lib/claude";
import { STAFF_ALLOCATION_INSIGHTS_SYSTEM } from "@/lib/prompts/staff-allocation-insights";
import { buildStaffAllocationInsightPayload } from "@/lib/staff-allocation-insights";
import { resolveRoleBoardRoleEntries } from "@/lib/role-boards";
import { callClaudeOrThrow } from "@/server/attendance";
import { httpErr } from "@/lib/http";
import type { StaffAllocationInsightsBody } from "@/lib/contracts/staff-allocation";

export type StaffAllocationPerson = {
  id: number;
  firstName: string;
  lastName: string | null;
  statuses: GroupingStudentStatus[];
};

export type StaffAllocationRole = {
  roleName: string;
  color: string;
  responsibilities: string[];
};

export type StaffAllocationGrouping = {
  groupingId: number;
  groupingName: string;
  containerTitle: string;
  containerIndex: number;
  students: StaffAllocationPerson[];
};

export type StaffAllocationItem = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  roles: StaffAllocationRole[];
  groupings: StaffAllocationGrouping[];
};

function personName(person: { firstName: string; lastName: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function byPersonName(a: { firstName: string; lastName: string | null }, b: typeof a) {
  return personName(a).localeCompare(personName(b));
}

export async function getStaffAllocationForView(
  viewId: number,
  engagementViewId?: number | null
): Promise<StaffAllocationItem[]> {
  const engagementDataViewId =
    engagementViewId != null &&
    Number.isFinite(engagementViewId) &&
    engagementViewId !== viewId
      ? engagementViewId
      : viewId;

  const [staffMembers, roleBoard, groupingRows, engagementStudents] = await Promise.all([
    getAllStaff(),
    getRoleBoardByViewId(viewId),
    db
      .select({
        id: groupings.id,
        name: groupings.name,
        containers: groupings.containers,
      })
      .from(groupings)
      .where(eq(groupings.viewId, viewId))
      .orderBy(asc(groupings.name)),
    getStudentsForView(engagementDataViewId),
  ]);

  const statusByStudentId = new Map(
    engagementStudents.map((student) => [student.id, student.statuses])
  );

  const studentIds = new Set<number>();
  for (const grouping of groupingRows) {
    for (const container of normalizeGroupingContainers(grouping.containers)) {
      for (const item of container.items) {
        if (item.entity === "student") studentIds.add(item.id);
      }
    }
  }

  const studentRows =
    studentIds.size > 0
      ? await db
          .select({
            id: students.id,
            firstName: students.firstName,
            lastName: students.lastName,
          })
          .from(students)
          .where(inArray(students.id, [...studentIds]))
      : [];

  const studentById = new Map(
    studentRows.map((student) => [
      student.id,
      {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        statuses: statusByStudentId.get(student.id) ?? [],
      } satisfies StaffAllocationPerson,
    ])
  );

  const byStaffId = new Map<number, StaffAllocationItem>(
    staffMembers.map((member) => [
      member.id,
      {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        gender: member.gender,
        roles: [],
        groupings: [],
      },
    ])
  );

  if (roleBoard) {
    for (const entry of resolveRoleBoardRoleEntries(roleBoard.rows)) {
      for (const person of entry.row.people) {
        if (!person || person.entity !== "staff") continue;
        const staffItem = byStaffId.get(person.id);
        if (!staffItem) continue;
        if (!staffItem.roles.some((role) => role.roleName === entry.displayName)) {
          staffItem.roles.push({
            roleName: entry.displayName,
            color: entry.color,
            responsibilities: entry.row.responsibilities,
          });
        }
      }
    }
  }

  for (const grouping of groupingRows) {
    const containers = normalizeGroupingContainers(grouping.containers);
    containers.forEach((container, containerIndex) => {
      const staffInContainer = container.items.filter((item) => item.entity === "staff");
      if (staffInContainer.length === 0) return;

      const containerStudents = container.items
        .filter((item) => item.entity === "student")
        .map((item) => studentById.get(item.id))
        .filter((student): student is StaffAllocationPerson => Boolean(student))
        .sort(byPersonName);

      const containerTitle = container.title.trim() || `Group ${containerIndex + 1}`;

      for (const staffRef of staffInContainer) {
        const staffItem = byStaffId.get(staffRef.id);
        if (!staffItem) continue;
        staffItem.groupings.push({
          groupingId: grouping.id,
          groupingName: grouping.name,
          containerTitle,
          containerIndex,
          students: containerStudents,
        });
      }
    });
  }

  return [...byStaffId.values()].sort((a, b) => {
    const aAssigned = a.roles.length + a.groupings.length > 0 ? 0 : 1;
    const bAssigned = b.roles.length + b.groupings.length > 0 ? 0 : 1;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;
    return byPersonName(a, b);
  });
}

export async function staffAllocationInsights(body: StaffAllocationInsightsBody) {
  const assignedCount = body.staff.filter(
    (member) => member.roles.length + member.groupings.length > 0
  ).length;

  if (body.staff.length === 0) {
    throw httpErr.badRequest("Add staff before generating allocation insights");
  }
  if (assignedCount === 0) {
    throw httpErr.badRequest(
      "No roles or grouping placements yet — assign staff first, then regenerate insights"
    );
  }

  const payload = buildStaffAllocationInsightPayload({
    viewName: body.viewName,
    viewFrom: body.viewFrom,
    viewTo: body.viewTo,
    staff: body.staff,
  });

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: HAIKU,
      max_tokens: 700,
      system: STAFF_ALLOCATION_INSIGHTS_SYSTEM,
      tools: [STAFF_ALLOCATION_INSIGHTS_TOOL],
      tool_choice: { type: "tool", name: STAFF_ALLOCATION_INSIGHTS_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Staff allocation snapshot:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    })
  );

  const tu = resp.content.find((block) => block.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");
  const out = tu.input as { insights: { headline: string; evidence: string }[] };
  return { insights: out.insights ?? [] };
}
