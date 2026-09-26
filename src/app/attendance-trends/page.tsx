import { getAttendanceTrendsPayload } from "@/server/attendance-trends";
import { getSemestersContext } from "@/server/dashboard-views";
import { parseAttendanceTrendsSeason } from "@/lib/attendance-trends";
import type { SemesterSeason } from "@/lib/semester-planning";
import AttendanceTrendsClient from "./AttendanceTrendsClient";

export const dynamic = "force-dynamic";

function seasonFromActiveView(season: string | undefined): SemesterSeason {
  return season === "spring" ? "spring" : "fall";
}

export default async function AttendanceTrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>;
}) {
  const sp = await searchParams;
  const { active } = await getSemestersContext();
  const season = sp.semester
    ? parseAttendanceTrendsSeason(sp.semester)
    : seasonFromActiveView(active?.season);

  const payload = await getAttendanceTrendsPayload(season);

  return (
    <div className="w-full px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Year Over Year</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Compare weekly attendance across {season === "fall" ? "Fall" : "Spring"} semesters.
          This view is not limited to the current semester.
        </p>
      </div>

      <AttendanceTrendsClient key={payload.season} payload={payload} />
    </div>
  );
}
