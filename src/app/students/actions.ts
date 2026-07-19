"use server";

import { db } from "@/lib/db";
import { students } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pickStudentFields } from "@/lib/changelog";
import { parseStudent } from "@/lib/parse-student";
import { logStudentDeleted, logStudentUpdated } from "@/server/changelog";

export async function updateStudentAction(id: number, formData: FormData) {
  const user = await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid student");

  const [existing] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!existing) throw new Error("Student not found");

  const data = parseStudent(formData);
  const before = pickStudentFields(existing as Record<string, unknown>);
  const after = pickStudentFields({ ...existing, ...data, updatedAt: new Date() });
  await db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id));
  await logStudentUpdated(user.id, id, before, after);
  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
}

export async function deleteStudentAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (student) await logStudentDeleted(user.id, student);
  await db.delete(students).where(eq(students.id, id));
  revalidatePath("/students");
}
