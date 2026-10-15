import { parseDecisionKind } from "@/lib/decisions";
import { resolveDashboardDateRange } from "@/lib/dashboard-date-range";
import { getSemestersContext } from "@/server/dashboard-views";
import { listDecisionStudents } from "@/server/decisions";
import DecisionsTool from "./DecisionsTool";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const { active } = await getSemestersContext();
  const fallback = resolveDashboardDateRange(
    active ? { from: active.from, to: active.to } : {}
  );
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : fallback.fromStr;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : fallback.toStr;
  const students = await listDecisionStudents();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Students who recorded a salvation or lordship decision. Filters start with{" "}
          {active ? active.name : "the last 30 days"}.
        </p>
      </div>
      <DecisionsTool
        students={students}
        initialFrom={from}
        initialTo={to}
        initialKind={parseDecisionKind(sp.kind)}
      />
    </div>
  );
}
