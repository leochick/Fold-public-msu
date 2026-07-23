import { and, asc, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "../../drizzle/schema";
import { parseDashboardDateStart } from "@/lib/dashboard-date-range";
import {
  buildSemesterColumn,
  getWeekEnd,
  getWeekStart,
  type SemesterPlanningColumn,
  type SemesterSeason,
} from "@/lib/semester-planning";
import { listAcademicYearDetails } from "@/server/academic-calendar";

export async function getSemesterPlanningColumns(
  season: SemesterSeason
): Promise<SemesterPlanningColumn[]> {
  const details = await listAcademicYearDetails();

  const candidates = details
    .map((year) => {
      const semester = season === "fall" ? year.fall : year.spring;
      if (!semester.classesBegin) return null;
      const classesBegin = parseDashboardDateStart(semester.classesBegin);
      if (!classesBegin) return null;
      return { year, semester, classesBegin };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  if (candidates.length === 0) return [];

  const rangeStarts = candidates.map(({ classesBegin }) => getWeekStart(classesBegin, 0));
  const rangeEnds = candidates.map(({ classesBegin }) => getWeekEnd(classesBegin, 16));
  const from = new Date(Math.min(...rangeStarts.map((d) => d.getTime())));
  const to = new Date(Math.max(...rangeEnds.map((d) => d.getTime())));

  const eventRows = await db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      notes: events.notes,
    })
    .from(events)
    .where(and(gte(events.startDate, from), lte(events.startDate, to)))
    .orderBy(asc(events.startDate));

  const planningEvents = eventRows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: new Date(row.startDate),
    notes: row.notes,
  }));

  return candidates
    .map(({ year, semester, classesBegin }) => {
      const week0 = getWeekStart(classesBegin, 0);
      const week16End = getWeekEnd(classesBegin, 16);
      const scopedEvents = planningEvents.filter(
        (event) => event.startDate >= week0 && event.startDate <= week16End
      );
      return buildSemesterColumn({
        academicYearId: year.id,
        yearName: year.name,
        season,
        semester,
        events: scopedEvents,
      });
    })
    .filter((column): column is SemesterPlanningColumn => column != null)
    .sort((a, b) => a.sortYear - b.sortYear || a.yearName.localeCompare(b.yearName));
}
