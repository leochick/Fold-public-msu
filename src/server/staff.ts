import { and, eq } from "drizzle-orm";
import type { StaffChild } from "../../drizzle/schema";
import { staff } from "../../drizzle/schema";
import { db } from "@/lib/db";

export type StaffPersistInput = {
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  startingDate: Date | null;
  endingDate: Date | null;
  spouseId: number | null;
  children: StaffChild[];
};

/**
 * Keep spouseId links bidirectional and mirror children onto the linked spouse.
 * When the spouse changes, the previous partner is unlinked (children are left as-is on them).
 */
async function reconcileSpouseAndChildren(params: {
  staffId: number;
  previousSpouseId: number | null;
  nextSpouseId: number | null;
  children: StaffChild[];
  now: Date;
}) {
  const { staffId, previousSpouseId, nextSpouseId, children, now } = params;

  if (previousSpouseId != null && previousSpouseId !== nextSpouseId) {
    await db
      .update(staff)
      .set({ spouseId: null, updatedAt: now })
      .where(and(eq(staff.id, previousSpouseId), eq(staff.spouseId, staffId)));
  }

  if (nextSpouseId == null || nextSpouseId === staffId) return;

  const [nextSpouse] = await db
    .select({ spouseId: staff.spouseId })
    .from(staff)
    .where(eq(staff.id, nextSpouseId))
    .limit(1);

  if (nextSpouse?.spouseId != null && nextSpouse.spouseId !== staffId) {
    await db
      .update(staff)
      .set({ spouseId: null, updatedAt: now })
      .where(and(eq(staff.id, nextSpouse.spouseId), eq(staff.spouseId, nextSpouseId)));
  }

  await db
    .update(staff)
    .set({ spouseId: staffId, children, updatedAt: now })
    .where(eq(staff.id, nextSpouseId));
}

export async function createStaffMember(data: StaffPersistInput): Promise<{ id: number }> {
  const nextSpouseId =
    data.spouseId != null && Number.isFinite(data.spouseId) ? data.spouseId : null;
  const now = new Date();
  const [row] = await db
    .insert(staff)
    .values({
      ...data,
      spouseId: nextSpouseId,
      updatedAt: now,
    })
    .returning({ id: staff.id });

  await reconcileSpouseAndChildren({
    staffId: row.id,
    previousSpouseId: null,
    nextSpouseId,
    children: data.children,
    now,
  });

  return row;
}

export async function updateStaffMember(id: number, data: StaffPersistInput): Promise<void> {
  const [existing] = await db
    .select({ spouseId: staff.spouseId })
    .from(staff)
    .where(eq(staff.id, id))
    .limit(1);
  if (!existing) return;

  const previousSpouseId = existing.spouseId;
  const nextSpouseId =
    data.spouseId != null && Number.isFinite(data.spouseId) && data.spouseId !== id
      ? data.spouseId
      : null;
  const now = new Date();

  await db
    .update(staff)
    .set({
      ...data,
      spouseId: nextSpouseId,
      updatedAt: now,
    })
    .where(eq(staff.id, id));

  await reconcileSpouseAndChildren({
    staffId: id,
    previousSpouseId,
    nextSpouseId,
    children: data.children,
    now,
  });
}
