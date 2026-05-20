"use server";

import { db } from "@/lib/db";
import { events } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function deleteEventAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/events");
}
