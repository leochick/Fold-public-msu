"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupings, views, type GroupingContainerData } from "../../drizzle/schema";
import { requireUser } from "@/lib/auth";
import { emptyGroupingContainers, normalizeGroupingContainers } from "@/lib/grouping-containers";

function assertContainers(containers: GroupingContainerData[]): GroupingContainerData[] {
  const normalized = normalizeGroupingContainers(containers);
  if (!normalized.length) {
    return emptyGroupingContainers();
  }
  return normalized.map((container) => ({
    title: container.title.trim(),
    items: container.items,
  }));
}

export async function createGroupingAction(
  viewId: number,
  name: string,
  eventAndStudentDataView: number | null = null
) {
  const user = await requireUser();
  if (!Number.isFinite(viewId)) throw new Error("Invalid view");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const [view] = await db.select({ id: views.id }).from(views).where(eq(views.id, viewId)).limit(1);
  if (!view) throw new Error("View not found");

  let dataViewId: number | null = null;
  if (eventAndStudentDataView != null && Number.isFinite(eventAndStudentDataView)) {
    if (eventAndStudentDataView !== viewId) {
      const [dataView] = await db
        .select({ id: views.id })
        .from(views)
        .where(eq(views.id, eventAndStudentDataView))
        .limit(1);
      if (!dataView) throw new Error("Event and student data view not found");
      dataViewId = dataView.id;
    }
  }

  const [created] = await db
    .insert(groupings)
    .values({
      name: trimmed,
      viewId,
      eventAndStudentDataView: dataViewId,
      checkedEventIds: null,
      includeNewsletterContacts: false,
      containers: emptyGroupingContainers(),
      addedByUserId: user.id,
    })
    .returning({ id: groupings.id });

  revalidatePath("/groupings");
  return created.id;
}

export async function updateGroupingAction(
  id: number,
  checkedEventIds: number[] | null,
  containers: GroupingContainerData[],
  includeNewsletterContacts = false
) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid grouping");

  const normalizedContainers = assertContainers(containers);
  const normalizedEventIds =
    checkedEventIds === null
      ? null
      : [...new Set(checkedEventIds.filter((eventId) => Number.isFinite(eventId)))];

  await db
    .update(groupings)
    .set({
      checkedEventIds: normalizedEventIds,
      includeNewsletterContacts: Boolean(includeNewsletterContacts),
      containers: normalizedContainers,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(groupings.id, id));

  revalidatePath("/groupings");
}

export async function renameGroupingAction(id: number, name: string) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid grouping");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  await db
    .update(groupings)
    .set({ name: trimmed, updatedAt: sql`(unixepoch())` })
    .where(eq(groupings.id, id));

  revalidatePath("/groupings");
}

export async function deleteGroupingAction(id: number) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid grouping");

  await db.delete(groupings).where(eq(groupings.id, id));

  revalidatePath("/groupings");
}
