"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  getPrimaryStatusBackground,
  GROUPING_STATUS_LABELS,
} from "@/lib/grouping-status";
import type { StaffAllocationItem, StaffAllocationPerson } from "@/server/staff-allocation";
import { loadStaffAllocationAction } from "../staff-allocation-actions";

function personName(person: { firstName: string; lastName: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function genderNameClass(gender: "M" | "F" | null | undefined) {
  if (gender === "M") return "text-blue-700 dark:text-blue-300";
  if (gender === "F") return "text-red-700 dark:text-red-300";
  return "";
}

function staffMatchesQuery(member: StaffAllocationItem, query: string): boolean {
  const haystack = [
    personName(member),
    ...member.roles.map((role) => role.roleName),
    ...member.groupings.flatMap((grouping) => [
      grouping.groupingName,
      grouping.containerTitle,
      ...grouping.students.map(personName),
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function StudentChip({ student }: { student: StaffAllocationPerson }) {
  const backgroundClass = getPrimaryStatusBackground(student.statuses);
  const statusTitle =
    student.statuses.length > 0
      ? student.statuses.map((status) => GROUPING_STATUS_LABELS[status]).join(", ")
      : undefined;

  return (
    <Link
      href={`/students/${student.id}`}
      title={statusTitle}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs hover:opacity-90 ${backgroundClass}`}
    >
      {personName(student)}
    </Link>
  );
}

type ViewOption = {
  id: number;
  name: string;
};

export default function StaffAllocationView({
  staff: initialStaff,
  viewId,
  viewName,
  otherViews,
}: {
  staff: StaffAllocationItem[];
  viewId: number;
  viewName: string;
  otherViews: ViewOption[];
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [query, setQuery] = useState("");
  const [hideUnassigned, setHideUnassigned] = useState(false);
  const [engagementView, setEngagementView] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const normalizedQuery = query.trim().toLowerCase();

  const assignedCount = useMemo(
    () => staff.filter((member) => member.roles.length + member.groupings.length > 0).length,
    [staff]
  );

  const filtered = useMemo(() => {
    return staff.filter((member) => {
      const assigned = member.roles.length + member.groupings.length > 0;
      if (hideUnassigned && !assigned) return false;
      if (normalizedQuery && !staffMatchesQuery(member, normalizedQuery)) return false;
      return true;
    });
  }, [staff, hideUnassigned, normalizedQuery]);

  const countLabel =
    normalizedQuery || hideUnassigned
      ? `${filtered.length} of ${staff.length}`
      : `${staff.length} total`;

  function onEngagementViewChange(value: string) {
    const previous = engagementView;
    setEngagementView(value);
    setLoadError(null);
    const dataViewId = value ? Number(value) : null;
    startTransition(async () => {
      try {
        const nextStaff = await loadStaffAllocationAction(
          viewId,
          dataViewId != null && Number.isFinite(dataViewId) ? dataViewId : null
        );
        setStaff(nextStaff);
      } catch (error) {
        setEngagementView(previous);
        setLoadError(
          error instanceof Error ? error.message : "Could not load engagement data"
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <label htmlFor="staff-allocation-engagement-view" className="label block mb-1">
          View for student engagement data
        </label>
        <select
          id="staff-allocation-engagement-view"
          className="input"
          value={engagementView}
          onChange={(event) => onEngagementViewChange(event.target.value)}
          disabled={otherViews.length === 0 || isPending}
        >
          <option value="">{viewName} (current view)</option>
          {otherViews.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
        {loadError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{loadError}</p>
        )}
        <p className="text-xs text-black/60 dark:text-white/60 mt-2">
          Engagement levels for students in groupings use this view&apos;s date range.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search staff, roles, groupings, students…"
          className="input flex-1"
          aria-label="Search staff allocation"
        />
        <label className="flex items-center gap-2 text-sm text-black/70 dark:text-white/70 whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideUnassigned}
            onChange={(event) => setHideUnassigned(event.target.checked)}
            className="rounded border-black/20"
          />
          Hide unassigned
        </label>
        {staff.length > 0 && (
          <span className="text-sm text-black/60 whitespace-nowrap shrink-0">{countLabel}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-black/60 dark:text-white/60">
        <span className="chip">{assignedCount} assigned</span>
        <span className="chip">{staff.length - assignedCount} unassigned</span>
        <span className="chip">View: {viewName}</span>
      </div>

      {staff.length === 0 ? (
        <div className="card">
          <p className="text-sm text-black/60 dark:text-white/60">
            No staff yet.{" "}
            <Link href="/staff/new" className="underline">
              Add one
            </Link>
            .
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <p className="text-sm text-black/60 dark:text-white/60">
            No matches
            {normalizedQuery ? (
              <>
                {" "}
                for &ldquo;{query.trim()}&rdquo;
              </>
            ) : null}
            {hideUnassigned ? " with the current filters" : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((member) => {
            const assigned = member.roles.length + member.groupings.length > 0;
            return (
              <section key={member.id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold leading-tight">
                      <Link
                        href={`/staff/${member.id}`}
                        className={`hover:underline ${genderNameClass(member.gender)}`}
                      >
                        {personName(member)}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                      {member.roles.length} role{member.roles.length === 1 ? "" : "s"}
                      {" · "}
                      {member.groupings.length} grouping placement
                      {member.groupings.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {!assigned && <span className="chip">Unassigned</span>}
                </div>

                <div className="space-y-2">
                  <h3 className="label">Roles</h3>
                  {member.roles.length === 0 ? (
                    <p className="text-sm text-black/45 dark:text-white/45">No roles in this view.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {member.roles.map((role) => (
                        <li key={role.roleName}>
                          <Link href="/roles" className="chip hover:bg-accent/10">
                            {role.roleName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="label">Groupings</h3>
                  {member.groupings.length === 0 ? (
                    <p className="text-sm text-black/45 dark:text-white/45">
                      Not placed in any grouping.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {member.groupings.map((grouping) => (
                        <li
                          key={`${grouping.groupingId}-${grouping.containerIndex}`}
                          className="rounded-lg border border-black/5 dark:border-white/10 p-3"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <Link
                              href={`/groupings?grouping=${grouping.groupingId}`}
                              className="text-sm font-medium hover:underline"
                            >
                              {grouping.groupingName}
                            </Link>
                            <span className="text-xs text-black/45 dark:text-white/45">
                              {grouping.containerTitle}
                            </span>
                          </div>
                          {grouping.students.length === 0 ? (
                            <p className="mt-2 text-xs text-black/45 dark:text-white/45">
                              No students in this container.
                            </p>
                          ) : (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {grouping.students.map((student) => (
                                <li key={student.id}>
                                  <StudentChip student={student} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
