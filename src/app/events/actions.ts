"use server";

import { db } from "@/lib/db";
import { events } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logEventDeleted } from "@/server/changelog";

export async function deleteEventAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (event) await logEventDeleted(user.id, event);
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/events");
}
