import { getSemesterPlanningColumns } from "@/server/semester-planning";
import type { SemesterSeason } from "@/lib/semester-planning";
import SemesterPlanningClient from "./SemesterPlanningClient";

export const dynamic = "force-dynamic";

function parseSeason(value: string | undefined): SemesterSeason {
  return value === "spring" ? "spring" : "fall";
}

export default async function SemesterPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>;
}) {
  const sp = await searchParams;
  const season = parseSeason(sp.semester);
  const columns = await getSemesterPlanningColumns(season);

  return (
    <div className="max-w-[96rem] mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Semester Planning</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Compare historic event notes week by week across{" "}
          {season === "fall" ? "Fall" : "Spring"} semesters. Weeks are Sunday–Saturday,
          with Week 1 starting the Sunday of classes begin.
        </p>
      </div>

      <SemesterPlanningClient season={season} columns={columns} />
    </div>
  );
}
