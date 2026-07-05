"use server";

import { db } from "@/lib/db";
import { students } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logStudentDeleted } from "@/server/changelog";

export async function deleteStudentAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (student) await logStudentDeleted(user.id, student);
  await db.delete(students).where(eq(students.id, id));
  revalidatePath("/students");
}
