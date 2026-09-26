"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  normalizeMinimumAttendance,
  normalizeRegularsContainers,
  type RegularsContainer,
} from "@/lib/regulars";
import { regularsBoards, views } from "../../drizzle/schema";

export async function saveRegularsBoardAction(
  viewId: number,
  minimumAttendance: number,
  containers: RegularsContainer[]
) {
  await requireUser();
  if (!Number.isFinite(viewId)) throw new Error("Invalid semester");

  const [view] = await db.select({ id: views.id }).from(views).where(eq(views.id, viewId)).limit(1);
  if (!view) throw new Error("Semester not found");

  const minimum = normalizeMinimumAttendance(minimumAttendance);
  const normalized = normalizeRegularsContainers(containers);

  await db
    .insert(regularsBoards)
    .values({
      viewId,
      minimumAttendance: minimum,
      containers: normalized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: regularsBoards.viewId,
      set: {
        minimumAttendance: minimum,
        containers: normalized,
        updatedAt: sql`(unixepoch())`,
      },
    });

  revalidatePath("/regulars");
}
