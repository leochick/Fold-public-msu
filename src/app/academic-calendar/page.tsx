import {
  getAcademicYearById,
  getFirstAcademicYear,
  listAcademicYears,
} from "@/server/academic-calendar";
import AcademicCalendarEditor from "./AcademicCalendarEditor";
import AcademicYearsSidebar from "./AcademicYearsSidebar";

export const dynamic = "force-dynamic";

export default async function AcademicCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const years = await listAcademicYears();
  const yearId = sp.year ? Number(sp.year) : null;
  const requestedYear =
    yearId != null && Number.isFinite(yearId) ? await getAcademicYearById(yearId) : null;
  const activeYear = requestedYear ?? (await getFirstAcademicYear());

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Academic Calendar</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Define academic years, term dates, and holidays. Changes save automatically.
        </p>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-6 items-start">
        <div className="row-start-1 col-start-1 self-start">
          <AcademicYearsSidebar years={years} activeYearId={activeYear?.id ?? null} />
        </div>

        <div className="row-start-1 col-start-2 min-w-0">
          {activeYear ? (
            <AcademicCalendarEditor key={activeYear.id} year={activeYear} />
          ) : (
            <div className="card">
              <p className="text-sm text-black/60 dark:text-white/60">
                Add an academic year in the sidebar to start setting calendar dates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
