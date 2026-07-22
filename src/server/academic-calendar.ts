import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicYears,
  emptyAcademicSemester,
  type AcademicSemesterData,
  type AcademicYear,
} from "../../drizzle/schema";

export type AcademicYearListItem = {
  id: number;
  name: string;
};

export type AcademicYearDetail = {
  id: number;
  name: string;
  fall: AcademicSemesterData;
  spring: AcademicSemesterData;
};

function normalizeSemester(value: AcademicSemesterData | null | undefined): AcademicSemesterData {
  const empty = emptyAcademicSemester();
  if (!value || typeof value !== "object") return empty;
  return {
    newStudentsMoveIn:
      typeof value.newStudentsMoveIn === "string" && value.newStudentsMoveIn.trim()
        ? value.newStudentsMoveIn.trim()
        : null,
    classesBegin:
      typeof value.classesBegin === "string" && value.classesBegin.trim()
        ? value.classesBegin.trim()
        : null,
    classesEnd:
      typeof value.classesEnd === "string" && value.classesEnd.trim()
        ? value.classesEnd.trim()
        : null,
    finalExamsStart:
      typeof value.finalExamsStart === "string" && value.finalExamsStart.trim()
        ? value.finalExamsStart.trim()
        : null,
    finalExamsEnd:
      typeof value.finalExamsEnd === "string" && value.finalExamsEnd.trim()
        ? value.finalExamsEnd.trim()
        : null,
    holidays: Array.isArray(value.holidays)
      ? value.holidays.map((holiday) => ({
          name: typeof holiday?.name === "string" ? holiday.name : "",
          startDate:
            typeof holiday?.startDate === "string" && holiday.startDate.trim()
              ? holiday.startDate.trim()
              : null,
          endDate:
            typeof holiday?.endDate === "string" && holiday.endDate.trim()
              ? holiday.endDate.trim()
              : null,
        }))
      : [],
  };
}

function toDetail(row: AcademicYear): AcademicYearDetail {
  return {
    id: row.id,
    name: row.name,
    fall: normalizeSemester(row.fall),
    spring: normalizeSemester(row.spring),
  };
}

export async function listAcademicYears(): Promise<AcademicYearListItem[]> {
  const rows = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .orderBy(asc(academicYears.name));
  return rows;
}

export async function getAcademicYearById(id: number): Promise<AcademicYearDetail | null> {
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(academicYears).where(eq(academicYears.id, id)).limit(1);
  return row ? toDetail(row) : null;
}

export async function getFirstAcademicYear(): Promise<AcademicYearDetail | null> {
  const [row] = await db.select().from(academicYears).orderBy(asc(academicYears.name)).limit(1);
  return row ? toDetail(row) : null;
}
