"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { views } from "../../drizzle/schema";
import { requireUser } from "@/lib/auth";
import { setActiveViewIdCookie } from "@/lib/active-view";
import { getDashboardViewById } from "@/server/dashboard-views";

function revalidateSemesterConsumers() {
  revalidatePath("/", "layout");
}

export async function selectDashboardViewAction(id: number) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid semester");
  const semester = await getDashboardViewById(id);
  if (!semester) throw new Error("Semester not found");

  await setActiveViewIdCookie(id);
  revalidateSemesterConsumers();
}

export async function setDefaultDashboardViewAction(id: number) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid semester");
  const semester = await getDashboardViewById(id);
  if (!semester) throw new Error("Semester not found");

  await db.update(views).set({ isDefault: false, updatedAt: sql`(unixepoch())` });
  await db
    .update(views)
    .set({ isDefault: true, updatedAt: sql`(unixepoch())` })
    .where(eq(views.id, id));

  revalidateSemesterConsumers();
}
