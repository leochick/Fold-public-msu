"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDashboardDateLabel, parseDashboardDateStart } from "@/lib/dashboard-date-range";
import {
  DECISION_KIND_OPTIONS,
  decisionStudentName,
  decisionTypeLabel,
  filterDecisionStudents,
  isValidDecisionRange,
  type DecisionKind,
  type DecisionStudent,
} from "@/lib/decisions";

function rangeLabel(from: string, to: string): string | null {
  const start = parseDashboardDateStart(from);
  const end = parseDashboardDateStart(to);
  if (!start || !end) return null;
  return `${formatDashboardDateLabel(start)} – ${formatDashboardDateLabel(end)}`;
}

export default function DecisionsTool({
  students,
  initialFrom,
  initialTo,
  initialKind,
}: {
  students: DecisionStudent[];
  initialFrom: string;
  initialTo: string;
  initialKind: DecisionKind;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [kind, setKind] = useState<DecisionKind>(initialKind);
  const rangeOk = isValidDecisionRange(from, to);

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("kind", kind);
    const next = `/decisions?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) window.history.replaceState(null, "", next);
  }, [from, to, kind]);

  const matches = useMemo(
    () => filterDecisionStudents(students, { from, to, kind }),
    [students, from, to, kind]
  );

  const dates = rangeLabel(from, to);
  const kindCaption =
    kind === "salvation"
      ? "Salvation decisions"
      : kind === "lordship"
        ? "Lordship decisions"
        : "Salvation and lordship decisions";

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <form
        className="card space-y-4 lg:sticky lg:top-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <h2 className="text-sm font-semibold">Filters</h2>

        <div>
          <label htmlFor="decision-from" className="label mb-1 block">
            Start date
          </label>
          <input
            id="decision-from"
            type="date"
            className="input"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="decision-to" className="label mb-1 block">
            End date
          </label>
          <input
            id="decision-to"
            type="date"
            className="input"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        <fieldset>
          <legend className="label mb-2 block">Decision type</legend>
          <div className="space-y-1.5">
            {DECISION_KIND_OPTIONS.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="decision-kind"
                  className="h-4 w-4"
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {!rangeOk && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Start date must be on or before the end date.
          </p>
        )}
      </form>

      <div className="min-w-0 space-y-6">
        <div className="card flex items-center justify-between gap-4">
          <div>
            <div className="label">Students</div>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              {dates ? `${kindCaption}, ${dates}` : kindCaption}
            </p>
          </div>
          <div className="text-4xl font-semibold tabular-nums">{rangeOk ? matches.length : "—"}</div>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold">Students who made decisions</h2>
          {!rangeOk ? (
            <p className="py-6 text-center text-sm text-black/50 dark:text-white/50">
              Choose a start date on or before the end date.
            </p>
          ) : matches.length === 0 ? (
            <p className="py-6 text-center text-sm text-black/50 dark:text-white/50">
              No students recorded a decision in this range.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((student) => {
                  const decisionDate = parseDashboardDateStart(student.decisionAt);
                  return (
                    <tr key={student.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td>
                        <Link
                          href={`/students/${student.id}`}
                          className="font-medium hover:underline"
                        >
                          {decisionStudentName(student)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {decisionDate ? formatDashboardDateLabel(decisionDate) : student.decisionAt}
                      </td>
                      <td>
                        <span className="chip">{decisionTypeLabel(student.decisionType)}</span>
                      </td>
                      <td className="max-w-xs text-sm text-black/70 dark:text-white/70">
                        {student.notes?.trim() ? (
                          student.notes
                        ) : (
                          <span className="text-black/30 dark:text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
