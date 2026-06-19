"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardDateRangeLabel } from "@/lib/dashboard-date-range";

export default function DashboardDateFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function apply() {
    if (!fromDate || !toDate || fromDate > toDate) return;
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    router.push(`/?${params.toString()}`);
  }

  const fromParsed = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null;
  const toParsed = toDate ? new Date(`${toDate}T00:00:00.000Z`) : null;
  const rangeLabel =
    fromParsed && toParsed && !Number.isNaN(fromParsed.getTime()) && !Number.isNaN(toParsed.getTime())
      ? dashboardDateRangeLabel(fromParsed, toParsed)
      : null;

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label htmlFor="dashboard-from" className="label block mb-1">
            From
          </label>
          <input
            id="dashboard-from"
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="dashboard-to" className="label block mb-1">
            To
          </label>
          <input
            id="dashboard-to"
            type="date"
            className="input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button type="button" className="btn" onClick={apply} disabled={!fromDate || !toDate || fromDate > toDate}>
          Apply
        </button>
      </div>
      {rangeLabel && (
        <p className="text-xs text-black/60 mt-2">
          Showing data for {rangeLabel}
        </p>
      )}
    </div>
  );
}
