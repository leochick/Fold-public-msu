"use client";

import { useEffect, useMemo, useState } from "react";
import type { StaffAllocationItem } from "@/server/staff-allocation";

type Insight = { headline: string; evidence: string };

function allocationSignature(staff: StaffAllocationItem[]) {
  return staff
    .map((member) => {
      const roles = member.roles.map((role) => role.roleName).join(",");
      const groupings = member.groupings
        .map(
          (grouping) =>
            `${grouping.groupingId}:${grouping.containerIndex}:${grouping.students.map((s) => s.id).join(",")}`
        )
        .join("|");
      return `${member.id}:{${roles}}/{${groupings}}`;
    })
    .join(";");
}

export default function StaffAllocationInsightsSidebar({
  staff,
  viewName,
  viewFrom,
  viewTo,
}: {
  staff: StaffAllocationItem[];
  viewName: string;
  viewFrom: string;
  viewTo: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const signature = useMemo(() => allocationSignature(staff), [staff]);

  async function fetchInsights() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/staff-allocation-insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewName, viewFrom, viewTo, staff }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load insights");
      setInsights(data.insights ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewName, viewFrom, viewTo, signature]);

  return (
    <aside
      className={`shrink-0 transition-all ${collapsed ? "w-10 self-start" : "w-full xl:w-80"}`}
      aria-label="Staff allocation insights"
    >
      <div className="card sticky top-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          {!collapsed && <span className="text-sm font-semibold">AI Insights</span>}
          <span className="text-black/50 dark:text-white/50 text-xs" aria-hidden>
            {collapsed ? "›" : "‹"}
          </span>
        </button>

        {!collapsed && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-black/50 dark:text-white/50">
              Workload patterns across roles and grouping placements in {viewName}.
            </p>

            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Insights</div>
                <button
                  type="button"
                  onClick={fetchInsights}
                  disabled={loading}
                  className="text-xs text-black/60 hover:underline disabled:opacity-50"
                >
                  {loading ? "thinking…" : "regenerate"}
                </button>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              {!insights && !error && (
                <p className="text-sm text-black/50">{loading ? "Thinking…" : "Waiting…"}</p>
              )}

              {insights && insights.length === 0 && !error && (
                <p className="text-sm text-black/50">No insights returned. Try regenerate.</p>
              )}

              {insights && insights.length > 0 && (
                <ul className="space-y-3">
                  {insights.map((insight, index) => (
                    <li key={`${insight.headline}-${index}`} className="text-sm">
                      <div className="font-medium leading-snug">{insight.headline}</div>
                      <div className="mt-0.5 text-xs text-black/60 dark:text-white/60 leading-snug">
                        {insight.evidence}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
