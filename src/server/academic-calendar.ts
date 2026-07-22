import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { formatDashboardDate } from "@/lib/dashboard-date-range";
import {
  academicYears,
  type AcademicHoliday,
  type AcademicYear,
} from "../../drizzle/schema";

export type AcademicYearListItem = {
  id: number;
  name: string;
};

export type AcademicYearDetail = {
  id: number;
  name: string;
  newStudentsMoveIn: string;
  classesBegin: string;
  classesEnd: string;
  finalExamsStart: string;
  finalExamsEnd: string;
  holidays: AcademicHoliday[];
};

function formatOptionalDate(d: Date | null): string {
  return d ? formatDashboardDate(d) : "";
}

function toDetail(row: AcademicYear): AcademicYearDetail {
  return {
    id: row.id,
    name: row.name,
    newStudentsMoveIn: formatOptionalDate(row.newStudentsMoveIn),
    classesBegin: formatOptionalDate(row.classesBegin),
    classesEnd: formatOptionalDate(row.classesEnd),
    finalExamsStart: formatOptionalDate(row.finalExamsStart),
    finalExamsEnd: formatOptionalDate(row.finalExamsEnd),
    holidays: Array.isArray(row.holidays) ? row.holidays : [],
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
