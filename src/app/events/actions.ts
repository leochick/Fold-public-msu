"use server";

import { db } from "@/lib/db";
import { events } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pickEventFields } from "@/lib/changelog";
import { logEventDeleted, logEventUpdated } from "@/server/changelog";

export async function updateEventTypeAction(eventId: number, type: string) {
  const user = await requireUser();
  if (!Number.isFinite(eventId)) throw new Error("Invalid event");

  const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!existing) throw new Error("Event not found");

  const nextType = type.trim() || null;
  if ((existing.type ?? null) === nextType) return;

  const before = pickEventFields(existing as Record<string, unknown>);
  await db.update(events).set({ type: nextType }).where(eq(events.id, eventId));
  await logEventUpdated(user.id, eventId, before, { ...before, type: nextType });
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
}

export async function deleteEventAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (event) await logEventDeleted(user.id, event);
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/events");
}
