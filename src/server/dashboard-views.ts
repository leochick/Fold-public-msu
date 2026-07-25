import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { views, type View } from "../../drizzle/schema";
import { formatDashboardDate } from "@/lib/dashboard-date-range";
import { getActiveViewIdFromCookie } from "@/lib/active-view";
import {
  listComputableAcademicSemesters,
  type AcademicSeason,
} from "@/lib/academic-semesters";
import { listAcademicYearDetails } from "@/server/academic-calendar";

/** Synced academic-calendar semester shown in the header dropdown. */
export type DashboardViewItem = {
  id: number;
  name: string;
  from: string;
  to: string;
  isDefault: boolean;
  academicYearId: number;
  season: AcademicSeason;
};

function toItem(view: View): DashboardViewItem | null {
  if (view.academicYearId == null || view.season == null) return null;
  return {
    id: view.id,
    name: view.name,
    from: formatDashboardDate(view.startDate),
    to: formatDashboardDate(view.endDate),
    isDefault: view.isDefault,
    academicYearId: view.academicYearId,
    season: view.season,
  };
}

function sortItems(items: DashboardViewItem[]): DashboardViewItem[] {
  // Newest date ranges first (most recent at the top of the Semesters menu).
  return items.slice().sort((a, b) => {
    if (a.from !== b.from) return b.from.localeCompare(a.from);
    if (a.to !== b.to) return b.to.localeCompare(a.to);
    return a.name.localeCompare(b.name);
  });
}

function sameUtcDay(a: Date, b: Date): boolean {
  return formatDashboardDate(a) === formatDashboardDate(b);
}

function semesterKey(academicYearId: number, season: AcademicSeason): string {
  return `${academicYearId}:${season}`;
}

/**
 * Upsert `views` rows from academic calendar so groupings/role boards keep stable ids.
 * Returns only semesters that currently have computable date ranges.
 */
export async function syncAcademicSemesterViews(): Promise<DashboardViewItem[]> {
  const years = await listAcademicYearDetails();
  const computable = listComputableAcademicSemesters(years);
  if (computable.length === 0) return [];

  const existing = await db
    .select()
    .from(views)
    .where(and(isNotNull(views.academicYearId), isNotNull(views.season)));

  const byKey = new Map<string, View>();
  for (const row of existing) {
    if (row.academicYearId == null || row.season == null) continue;
    byKey.set(semesterKey(row.academicYearId, row.season), row);
  }

  const legacyRows = await db.select().from(views).where(isNull(views.academicYearId));
  const claimedLegacyIds = new Set<number>();

  const synced: View[] = [];

  for (const semester of computable) {
    const key = semesterKey(semester.academicYearId, semester.season);
    let row = byKey.get(key) ?? null;

    if (!row) {
      // Prefer adopting a legacy view so existing groupings/role boards keep their FK.
      const byName = legacyRows.find(
        (legacy) => !claimedLegacyIds.has(legacy.id) && legacy.name === semester.name
      );
      const byDates =
        byName ??
        legacyRows.find(
          (legacy) =>
            !claimedLegacyIds.has(legacy.id) &&
            sameUtcDay(legacy.startDate, semester.startDate) &&
            sameUtcDay(legacy.endDate, semester.endDate)
        );
      row = byDates ?? null;
    }

    if (row) {
      claimedLegacyIds.add(row.id);
      await db
        .update(views)
        .set({
          name: semester.name,
          startDate: semester.startDate,
          endDate: semester.endDate,
          academicYearId: semester.academicYearId,
          season: semester.season,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(views.id, row.id));
      const updated: View = {
        ...row,
        name: semester.name,
        startDate: semester.startDate,
        endDate: semester.endDate,
        academicYearId: semester.academicYearId,
        season: semester.season,
      };
      synced.push(updated);
      byKey.set(key, updated);
    } else {
      const [created] = await db
        .insert(views)
        .values({
          name: semester.name,
          startDate: semester.startDate,
          endDate: semester.endDate,
          academicYearId: semester.academicYearId,
          season: semester.season,
          isDefault: false,
        })
        .returning();
      synced.push(created);
      byKey.set(key, created);
    }
  }

  const items = synced.map(toItem).filter((item): item is DashboardViewItem => item != null);
  if (items.length === 0) return [];

  if (!items.some((item) => item.isDefault)) {
    const firstId = items.slice().sort((a, b) => a.from.localeCompare(b.from))[0]!.id;
    await db.update(views).set({ isDefault: false });
    await db
      .update(views)
      .set({ isDefault: true, updatedAt: sql`(unixepoch())` })
      .where(eq(views.id, firstId));
    for (const item of items) {
      item.isDefault = item.id === firstId;
    }
  }

  return sortItems(items);
}

export async function listDashboardViews(): Promise<DashboardViewItem[]> {
  return syncAcademicSemesterViews();
}

export async function getDashboardViewById(id: number): Promise<DashboardViewItem | null> {
  if (!Number.isFinite(id)) return null;
  const items = await syncAcademicSemesterViews();
  return items.find((item) => item.id === id) ?? null;
}

export async function getDefaultDashboardView(): Promise<DashboardViewItem | null> {
  const items = await syncAcademicSemesterViews();
  return items.find((item) => item.isDefault) ?? items[0] ?? null;
}

/** Cookie selection among computable semesters, else default, else null. */
export async function getActiveDashboardView(): Promise<DashboardViewItem | null> {
  const { active } = await getSemestersContext();
  return active;
}

/** One sync for layout / pages that need both the list and the active semester. */
export async function getSemestersContext(): Promise<{
  semesters: DashboardViewItem[];
  active: DashboardViewItem | null;
}> {
  const semesters = await syncAcademicSemesterViews();
  const cookieId = await getActiveViewIdFromCookie();
  const active =
    (cookieId != null ? semesters.find((item) => item.id === cookieId) : null) ??
    semesters.find((item) => item.isDefault) ??
    semesters[0] ??
    null;
  return { semesters, active };
}
