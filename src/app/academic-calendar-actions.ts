"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDashboardDateEnd, parseDashboardDateStart } from "@/lib/dashboard-date-range";
import { academicYears, type AcademicHoliday } from "../../drizzle/schema";

function normalizeHolidays(holidays: AcademicHoliday[]): AcademicHoliday[] {
  if (!Array.isArray(holidays)) return [];
  return holidays.map((holiday) => ({
    name: typeof holiday?.name === "string" ? holiday.name : "",
    startDate:
      typeof holiday?.startDate === "string" && holiday.startDate.trim()
        ? holiday.startDate.trim()
        : null,
    endDate:
      typeof holiday?.endDate === "string" && holiday.endDate.trim()
        ? holiday.endDate.trim()
        : null,
  }));
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  return parseDashboardDateStart(value.trim());
}

function parseOptionalEndDate(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) return null;
  return parseDashboardDateEnd(value.trim());
}

export async function createAcademicYearAction(name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  try {
    const [created] = await db
      .insert(academicYears)
      .values({
        name: trimmed,
        holidays: [],
        addedByUserId: user.id,
      })
      .returning({ id: academicYears.id });

    revalidatePath("/academic-calendar");
    return created.id;
  } catch {
    throw new Error("An academic year with that name already exists");
  }
}

export async function updateAcademicYearAction(
  id: number,
  data: {
    newStudentsMoveIn: string;
    classesBegin: string;
    classesEnd: string;
    finalExamsStart: string;
    finalExamsEnd: string;
    holidays: AcademicHoliday[];
  }
) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid academic year");

  await db
    .update(academicYears)
    .set({
      newStudentsMoveIn: parseOptionalDate(data.newStudentsMoveIn),
      classesBegin: parseOptionalDate(data.classesBegin),
      classesEnd: parseOptionalDate(data.classesEnd),
      finalExamsStart: parseOptionalDate(data.finalExamsStart),
      finalExamsEnd: parseOptionalEndDate(data.finalExamsEnd),
      holidays: normalizeHolidays(data.holidays),
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(academicYears.id, id));

  revalidatePath("/academic-calendar");
}

export async function renameAcademicYearAction(id: number, name: string) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid academic year");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  try {
    await db
      .update(academicYears)
      .set({
        name: trimmed,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(academicYears.id, id));
  } catch {
    throw new Error("An academic year with that name already exists");
  }

  revalidatePath("/academic-calendar");
}

export async function deleteAcademicYearAction(id: number) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid academic year");

  await db.delete(academicYears).where(eq(academicYears.id, id));
  revalidatePath("/academic-calendar");
}
