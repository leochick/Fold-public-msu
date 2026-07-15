import type { StaffAllocationItem } from "@/server/staff-allocation";

export type StaffAllocationInsightPayload = {
  viewName: string;
  viewFrom: string;
  viewTo: string;
  staffTotal: number;
  assignedStaff: number;
  unassignedStaff: number;
  averages: {
    rolesAmongAssigned: number;
    uniqueStudentsAmongAssigned: number;
    groupingPlacementsAmongAssigned: number;
  };
  staff: Array<{
    name: string;
    assigned: boolean;
    roles: string[];
    roleCount: number;
    uniqueStudentCount: number;
    groupingPlacementCount: number;
    groupings: Array<{
      grouping: string;
      container: string;
      studentCount: number;
      students: string[];
    }>;
  }>;
};

function personName(person: { firstName: string; lastName: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function uniqueStudentIds(member: StaffAllocationItem): number[] {
  const ids = new Set<number>();
  for (const grouping of member.groupings) {
    for (const student of grouping.students) ids.add(student.id);
  }
  return [...ids];
}

export function buildStaffAllocationInsightPayload(input: {
  viewName: string;
  viewFrom: string;
  viewTo: string;
  staff: StaffAllocationItem[];
}): StaffAllocationInsightPayload {
  const staffRows = input.staff.map((member) => {
    const uniqueIds = uniqueStudentIds(member);
    const roleCount = member.roles.length;
    const groupingPlacementCount = member.groupings.length;
    const assigned = roleCount + groupingPlacementCount > 0;

    return {
      name: personName(member),
      assigned,
      roles: member.roles.map((role) => role.roleName),
      roleCount,
      uniqueStudentCount: uniqueIds.length,
      groupingPlacementCount,
      groupings: member.groupings.map((grouping) => ({
        grouping: grouping.groupingName,
        container: grouping.containerTitle,
        studentCount: grouping.students.length,
        students: grouping.students.map(personName),
      })),
    };
  });

  const assigned = staffRows.filter((row) => row.assigned);
  const avg = (values: number[]) =>
    values.length === 0 ? 0 : round1(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    viewName: input.viewName,
    viewFrom: input.viewFrom,
    viewTo: input.viewTo,
    staffTotal: staffRows.length,
    assignedStaff: assigned.length,
    unassignedStaff: staffRows.length - assigned.length,
    averages: {
      rolesAmongAssigned: avg(assigned.map((row) => row.roleCount)),
      uniqueStudentsAmongAssigned: avg(assigned.map((row) => row.uniqueStudentCount)),
      groupingPlacementsAmongAssigned: avg(assigned.map((row) => row.groupingPlacementCount)),
    },
    staff: staffRows,
  };
}
