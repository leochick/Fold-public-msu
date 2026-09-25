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

function parseEventDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Enter a valid date");
  const [year, month, day] = date.split("-").map(Number);
  const startDate = new Date(year, month - 1, day);
  if (
    Number.isNaN(startDate.getTime()) ||
    startDate.getFullYear() !== year ||
    startDate.getMonth() !== month - 1 ||
    startDate.getDate() !== day
  ) {
    throw new Error("Enter a valid date");
  }
  return startDate;
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function updateEventDetailsAction(eventId: number, formData: FormData) {
  const user = await requireUser();
  if (!Number.isFinite(eventId)) throw new Error("Invalid event");

  const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!existing) throw new Error("Event not found");

  const date = String(formData.get("date") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const parsedDate = parseEventDate(date);
  const existingDate = new Date(existing.startDate);
  const startDate = sameCalendarDay(existingDate, parsedDate) ? existingDate : parsedDate;
  const nextType = type || null;
  const nextLocation = location || null;
  const nextNotes = notes || null;

  if (
    startDate === existingDate &&
    (existing.type ?? null) === nextType &&
    (existing.location ?? null) === nextLocation &&
    (existing.notes ?? null) === nextNotes
  ) {
    return;
  }

  const before = pickEventFields(existing as Record<string, unknown>);
  const patch = {
    startDate,
    type: nextType,
    location: nextLocation,
    notes: nextNotes,
  };
  await db.update(events).set(patch).where(eq(events.id, eventId));
  await logEventUpdated(user.id, eventId, before, { ...before, ...patch });
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
