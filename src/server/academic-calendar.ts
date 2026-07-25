import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { findNextAcademicYear } from "@/lib/academic-calendar-breaks";
import {
  academicYears,
  emptyAcademicBreak,
  emptyAcademicSemester,
  type AcademicBreakData,
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
  winter: AcademicBreakData;
  summer: AcademicBreakData;
  /** Fall semester of the following academic year, when available. */
  nextFall: AcademicSemesterData | null;
  nextYearName: string | null;
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

function normalizeBreak(value: AcademicBreakData | null | undefined): AcademicBreakData {
  if (!value || typeof value !== "object") return emptyAcademicBreak();
  return {
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

function toDetail(row: AcademicYear, all: AcademicYear[]): AcademicYearDetail {
  const next = findNextAcademicYear(
    all.map((year) => ({ id: year.id, name: year.name })),
    { id: row.id, name: row.name }
  );
  const nextRow = next ? all.find((year) => year.id === next.id) : null;

  return {
    id: row.id,
    name: row.name,
    fall: normalizeSemester(row.fall),
    spring: normalizeSemester(row.spring),
    winter: normalizeBreak(row.winter),
    summer: normalizeBreak(row.summer),
    nextFall: nextRow ? normalizeSemester(nextRow.fall) : null,
    nextYearName: nextRow?.name ?? null,
  };
}

export async function listAcademicYears(): Promise<AcademicYearListItem[]> {
  const rows = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .orderBy(desc(academicYears.name));
  return rows;
}

export async function listAcademicYearDetails(): Promise<AcademicYearDetail[]> {
  const rows = await db.select().from(academicYears).orderBy(desc(academicYears.name));
  return rows.map((row) => toDetail(row, rows));
}

export async function getAcademicYearById(id: number): Promise<AcademicYearDetail | null> {
  if (!Number.isFinite(id)) return null;
  const rows = await db.select().from(academicYears).orderBy(desc(academicYears.name));
  const row = rows.find((year) => year.id === id);
  return row ? toDetail(row, rows) : null;
}

export async function getFirstAcademicYear(): Promise<AcademicYearDetail | null> {
  const rows = await db.select().from(academicYears).orderBy(desc(academicYears.name));
  const row = rows[0];
  return row ? toDetail(row, rows) : null;
}
