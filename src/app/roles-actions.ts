"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { roleBoards, views, type RoleBoardRow } from "../../drizzle/schema";
import { requireUser } from "@/lib/auth";
import { normalizeRoleBoardRows } from "@/lib/role-boards";

async function assertViewExists(viewId: number) {
  const [view] = await db.select({ id: views.id }).from(views).where(eq(views.id, viewId)).limit(1);
  if (!view) throw new Error("View not found");
}

export async function updateRoleBoardAction(
  id: number,
  payload: {
    eventAndStudentDataView?: number | null;
    personColumnCount: number;
    rows: RoleBoardRow[];
  }
) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid role board");

  const [existing] = await db
    .select({ id: roleBoards.id, viewId: roleBoards.viewId })
    .from(roleBoards)
    .where(eq(roleBoards.id, id))
    .limit(1);
  if (!existing) throw new Error("Role board not found");

  const personColumnCount = Math.max(0, Math.floor(payload.personColumnCount) || 0);
  const rows = normalizeRoleBoardRows(payload.rows, personColumnCount);

  let dataViewId: number | null | undefined = payload.eventAndStudentDataView;
  if (dataViewId !== undefined) {
    if (dataViewId == null) {
      dataViewId = null;
    } else if (!Number.isFinite(dataViewId)) {
      throw new Error("Invalid event and student data view");
    } else if (dataViewId === existing.viewId) {
      dataViewId = null;
    } else {
      await assertViewExists(dataViewId);
    }
  }

  await db
    .update(roleBoards)
    .set({
      ...(dataViewId !== undefined ? { eventAndStudentDataView: dataViewId } : {}),
      personColumnCount,
      rows,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(roleBoards.id, id));

  revalidatePath("/roles");
  revalidatePath("/staff-allocation");
}
