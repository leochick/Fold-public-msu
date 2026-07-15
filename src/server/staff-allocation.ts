import { db } from "@/lib/db";
import { groupings, students } from "../../drizzle/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { normalizeGroupingContainers } from "@/lib/grouping-containers";
import { getAllStaff } from "@/server/groupings";
import { getRoleBoardByViewId } from "@/server/roles";

export type StaffAllocationPerson = {
  id: number;
  firstName: string;
  lastName: string | null;
};

export type StaffAllocationRole = {
  roleName: string;
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

export async function getStaffAllocationForView(viewId: number): Promise<StaffAllocationItem[]> {
  const [staffMembers, roleBoard, groupingRows] = await Promise.all([
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
  ]);

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
    for (const row of roleBoard.rows) {
      const roleName = row.name.trim() || "Untitled role";
      for (const person of row.people) {
        if (!person || person.entity !== "staff") continue;
        const staffItem = byStaffId.get(person.id);
        if (!staffItem) continue;
        if (!staffItem.roles.some((role) => role.roleName === roleName)) {
          staffItem.roles.push({ roleName });
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
