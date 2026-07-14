import { db } from "@/lib/db";
import { roleBoards, views, type RoleBoardRow } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { emptyRoleBoardRows, normalizeRoleBoardRows } from "@/lib/role-boards";
import {
  getAllStaff,
  getStudentsForView,
  type GroupingStaffItem,
  type GroupingStudentItem,
} from "@/server/groupings";

const eventAndStudentDataViews = alias(views, "role_board_data_views");

export type RoleBoardDetail = {
  id: number;
  viewId: number;
  viewName: string;
  eventAndStudentDataView: number | null;
  eventAndStudentDataViewName: string | null;
  personColumnCount: number;
  rows: RoleBoardRow[];
};

export type RoleBoardPersonOption = {
  entity: "student" | "staff";
  id: number;
  firstName: string;
  lastName: string | null;
};

/** View id used for loading students for a role board. */
export function getRoleBoardDataViewId(board: {
  viewId: number;
  eventAndStudentDataView: number | null;
}): number {
  return board.eventAndStudentDataView ?? board.viewId;
}

export async function getRoleBoardByViewId(viewId: number): Promise<RoleBoardDetail | null> {
  const [row] = await db
    .select({
      board: roleBoards,
      viewName: views.name,
      eventAndStudentDataViewName: eventAndStudentDataViews.name,
    })
    .from(roleBoards)
    .innerJoin(views, eq(roleBoards.viewId, views.id))
    .leftJoin(
      eventAndStudentDataViews,
      eq(roleBoards.eventAndStudentDataView, eventAndStudentDataViews.id)
    )
    .where(eq(roleBoards.viewId, viewId))
    .limit(1);

  if (!row) return null;

  const dataViewId =
    row.board.eventAndStudentDataView != null &&
    row.board.eventAndStudentDataView !== row.board.viewId
      ? row.board.eventAndStudentDataView
      : null;

  const personColumnCount = Math.max(0, row.board.personColumnCount ?? 0);

  return {
    id: row.board.id,
    viewId: row.board.viewId,
    viewName: row.viewName,
    eventAndStudentDataView: dataViewId,
    eventAndStudentDataViewName: dataViewId != null ? row.eventAndStudentDataViewName : null,
    personColumnCount,
    rows: normalizeRoleBoardRows(row.board.rows, personColumnCount),
  };
}

export async function ensureRoleBoardForView(
  viewId: number,
  userId: string
): Promise<RoleBoardDetail> {
  const existing = await getRoleBoardByViewId(viewId);
  if (existing) return existing;

  await db.insert(roleBoards).values({
    viewId,
    eventAndStudentDataView: null,
    personColumnCount: 0,
    rows: emptyRoleBoardRows(),
    addedByUserId: userId,
  });

  const created = await getRoleBoardByViewId(viewId);
  if (!created) throw new Error("Failed to create role board");
  return created;
}

function toPersonOption(
  entity: "student" | "staff",
  person: Pick<GroupingStudentItem | GroupingStaffItem, "id" | "firstName" | "lastName">
): RoleBoardPersonOption {
  return {
    entity,
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
  };
}

export async function getRoleBoardPersonOptions(
  dataViewId: number
): Promise<RoleBoardPersonOption[]> {
  const [students, staffMembers] = await Promise.all([
    getStudentsForView(dataViewId),
    getAllStaff(),
  ]);

  const staffOptions = staffMembers.map((member) => toPersonOption("staff", member));
  const studentOptions = students.map((student) => toPersonOption("student", student));

  const byName = (a: RoleBoardPersonOption, b: RoleBoardPersonOption) => {
    const aName = `${a.firstName} ${a.lastName ?? ""}`.trim();
    const bName = `${b.firstName} ${b.lastName ?? ""}`.trim();
    return aName.localeCompare(bName);
  };

  return [...staffOptions.sort(byName), ...studentOptions.sort(byName)];
}
