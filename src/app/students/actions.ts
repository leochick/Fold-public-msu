"use server";

import { db } from "@/lib/db";
import { students } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export async function deleteStudentAction(formData: FormData) {
  await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(students).where(eq(students.id, id));
  revalidatePath("/students");
}
