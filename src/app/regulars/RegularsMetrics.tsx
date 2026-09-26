"use client";

import type { ReactNode } from "react";
import {
  containerDisplayTitle,
  genderGroups,
  regularsForEvents,
  studentDisplayName,
  type RegularsAttendance,
  type RegularsContainer,
  type RegularsStudent,
} from "@/lib/regulars";

function NameList({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {names.map((name, index) => (
        <li key={`${name}-${index}`}>{name}</li>
      ))}
    </ul>
  );
}

function CountCard({
  title,
  caption,
  summary,
  tooltip,
  children,
}: {
  title: string;
  caption: string;
  summary: string;
  tooltip: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative group min-w-[11rem]">
      <div
        tabIndex={0}
        className="card h-full cursor-default outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={`${title}, ${caption}. ${summary}`}
      >
        <div className="label">{title}</div>
        <div className="mt-1 text-xs text-black/50 dark:text-white/50">{caption}</div>
        <div className="mt-1">{children}</div>
      </div>
      <div className="absolute left-0 top-full z-30 hidden pt-1 group-hover:block group-focus-within:block">
        <div
          role="tooltip"
          className="w-56 max-h-64 overflow-y-auto rounded-lg border border-black/10 dark:border-white/15 bg-paper dark:bg-ink p-2 text-xs shadow-lg"
        >
          {tooltip}
        </div>
      </div>
    </div>
  );
}

export default function RegularsMetrics({
  containers,
  containerKeys,
  students,
  attendances,
  minimumInput,
  onMinimumInputChange,
  onMinimumBlur,
}: {
  containers: RegularsContainer[];
  containerKeys: string[];
  students: RegularsStudent[];
  attendances: RegularsAttendance[];
  minimumInput: string;
  onMinimumInputChange: (value: string) => void;
  onMinimumBlur: () => void;
}) {
  const minimum = minimumInput.trim() === "" ? 2 : Number(minimumInput);

  return (
    <div className="card">
      <h2 className="text-sm font-semibold mb-3">Metrics</h2>
      <div className="max-w-xs">
        <label htmlFor="regulars-minimum" className="label block mb-1">
          Minimum Attendance to be Considered a Regular
        </label>
        <input
          id="regulars-minimum"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className="input w-28"
          value={minimumInput}
          onChange={(event) => onMinimumInputChange(event.target.value)}
          onBlur={onMinimumBlur}
        />
      </div>
      <p className="text-xs text-black/50 dark:text-white/50 mt-2">
        A student counts as a regular in a container when they attended at least this many of its
        events.
      </p>

      {containers.length === 0 ? (
        <p className="text-xs text-black/50 dark:text-white/50 mt-3">
          Add a container and drop events into it, or auto-populate by event type, to see regulars.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3 mt-4">
          {containers.map((container, index) => {
            const title = containerDisplayTitle(container.title, index);
            const regulars = regularsForEvents(
              container.eventIds,
              students,
              attendances,
              minimum
            );
            const groups = genderGroups(regulars);
            const regularNames = regulars.map(studentDisplayName);
            const summary = regularNames.length > 0 ? regularNames.join(", ") : "No students";
            const genderSummary = [
              groups.male.length
                ? `Male: ${groups.male.map(studentDisplayName).join(", ")}`
                : null,
              groups.female.length
                ? `Female: ${groups.female.map(studentDisplayName).join(", ")}`
                : null,
              groups.unspecified.length
                ? `Unspecified: ${groups.unspecified.map(studentDisplayName).join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(". ");

            return (
              <div key={containerKeys[index] ?? `metric-${index}`} className="flex flex-wrap gap-3">
                <CountCard
                  title={title}
                  caption="Regulars"
                  summary={summary}
                  tooltip={
                    regularNames.length === 0 ? (
                      <p className="text-black/50 dark:text-white/50">No students</p>
                    ) : (
                      <NameList names={regularNames} />
                    )
                  }
                >
                  <div className="text-3xl font-semibold tabular-nums">{regulars.length}</div>
                </CountCard>
                <CountCard
                  title={title}
                  caption="Gender"
                  summary={genderSummary || "No students"}
                  tooltip={<GenderTooltip groups={groups} />}
                >
                  <div className="text-2xl font-semibold tabular-nums leading-tight">
                    <span className="text-blue-700 dark:text-blue-300">{groups.male.length} M</span>
                    <span className="text-black/30 dark:text-white/30"> · </span>
                    <span className="text-red-700 dark:text-red-300">{groups.female.length} F</span>
                    {groups.unspecified.length > 0 && (
                      <>
                        <span className="text-black/30 dark:text-white/30"> · </span>
                        <span>{groups.unspecified.length} unspecified</span>
                      </>
                    )}
                  </div>
                </CountCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GenderTooltip({
  groups,
}: {
  groups: ReturnType<typeof genderGroups>;
}) {
  const sections = [
    { label: "Male", className: "text-blue-700 dark:text-blue-300", people: groups.male },
    { label: "Female", className: "text-red-700 dark:text-red-300", people: groups.female },
    { label: "Unspecified", className: "text-black/70 dark:text-white/70", people: groups.unspecified },
  ].filter((section) => section.people.length > 0);

  if (sections.length === 0) {
    return <p className="text-black/50 dark:text-white/50">No students</p>;
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.label}>
          <p className={`font-medium ${section.className}`}>{section.label}</p>
          <NameList names={section.people.map(studentDisplayName)} />
        </div>
      ))}
    </div>
  );
}
