"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { views } from "../../drizzle/schema";
import { requireUser } from "@/lib/auth";
import { getStaffAllocationForView } from "@/server/staff-allocation";

async function assertViewExists(viewId: number) {
  const [view] = await db.select({ id: views.id }).from(views).where(eq(views.id, viewId)).limit(1);
  if (!view) throw new Error("View not found");
}

/** Load staff allocation with engagement levels from an optional alternate view (ephemeral). */
export async function loadStaffAllocationAction(
  viewId: number,
  engagementViewId: number | null
) {
  await requireUser();
  if (!Number.isFinite(viewId)) throw new Error("Invalid view");
  await assertViewExists(viewId);

  let dataViewId: number | null = engagementViewId;
  if (dataViewId == null) {
    dataViewId = null;
  } else if (!Number.isFinite(dataViewId)) {
    throw new Error("Invalid student engagement data view");
  } else if (dataViewId === viewId) {
    dataViewId = null;
  } else {
    await assertViewExists(dataViewId);
  }

  return getStaffAllocationForView(viewId, dataViewId);
}
