"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  academicYears,
  emptyAcademicSemester,
  type AcademicHoliday,
  type AcademicSemesterData,
} from "../../drizzle/schema";

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

function normalizeSemester(semester: AcademicSemesterData): AcademicSemesterData {
  return {
    newStudentsMoveIn:
      typeof semester?.newStudentsMoveIn === "string" && semester.newStudentsMoveIn.trim()
        ? semester.newStudentsMoveIn.trim()
        : null,
    classesBegin:
      typeof semester?.classesBegin === "string" && semester.classesBegin.trim()
        ? semester.classesBegin.trim()
        : null,
    classesEnd:
      typeof semester?.classesEnd === "string" && semester.classesEnd.trim()
        ? semester.classesEnd.trim()
        : null,
    finalExamsStart:
      typeof semester?.finalExamsStart === "string" && semester.finalExamsStart.trim()
        ? semester.finalExamsStart.trim()
        : null,
    finalExamsEnd:
      typeof semester?.finalExamsEnd === "string" && semester.finalExamsEnd.trim()
        ? semester.finalExamsEnd.trim()
        : null,
    holidays: normalizeHolidays(semester?.holidays ?? []),
  };
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
        fall: emptyAcademicSemester(),
        spring: emptyAcademicSemester(),
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
    fall: AcademicSemesterData;
    spring: AcademicSemesterData;
  }
) {
  await requireUser();
  if (!Number.isFinite(id)) throw new Error("Invalid academic year");

  await db
    .update(academicYears)
    .set({
      fall: normalizeSemester(data.fall),
      spring: normalizeSemester(data.spring),
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
