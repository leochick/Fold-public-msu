"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { views } from "../../drizzle/schema";
import { requireUser } from "@/lib/auth";
import { parseDashboardDateEnd, parseDashboardDateStart } from "@/lib/dashboard-date-range";

function assertValidDateRange(from: string, to: string) {
  const start = parseDashboardDateStart(from);
  const end = parseDashboardDateEnd(to);
  if (!start || !end || start > end) {
    throw new Error("Invalid date range");
  }
  return { start, end };
}

export async function saveDashboardViewAction(from: string, to: string, name: string) {
  const user = await requireUser();
  const { start, end } = assertValidDateRange(from, to);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const existing = await db.select({ id: views.id }).from(views);
  const isFirst = existing.length === 0;

  await db.insert(views).values({
    name: trimmed,
    startDate: start,
    endDate: end,
    addedByUserId: user.id,
    isDefault: isFirst,
  });

  revalidatePath("/");
}

export async function renameDashboardViewAction(id: number, name: string) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid view");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  await db
    .update(views)
    .set({ name: trimmed, updatedAt: sql`(unixepoch())` })
    .where(eq(views.id, id));

  revalidatePath("/");
}

export async function setDefaultDashboardViewAction(id: number) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid view");

  await db.update(views).set({ isDefault: false, updatedAt: sql`(unixepoch())` });
  await db
    .update(views)
    .set({ isDefault: true, updatedAt: sql`(unixepoch())` })
    .where(eq(views.id, id));

  revalidatePath("/");
}
