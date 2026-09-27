"use client";

import type { ReactNode } from "react";
import {
  christianGroups,
  containerDisplayTitle,
  genderGroups,
  REGULAR_YEAR_ROWS,
  regularsForEvents,
  studentDisplayName,
  yearGroups,
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
  minimum,
  onMinimumInputChange,
  onMinimumBlur,
  saveStatus,
  saveError,
}: {
  containers: RegularsContainer[];
  containerKeys: string[];
  students: RegularsStudent[];
  attendances: RegularsAttendance[];
  minimumInput: string;
  minimum: number;
  onMinimumInputChange: (value: string) => void;
  onMinimumBlur: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
}) {
  const statusLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : null;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold">Metrics</h2>
        {statusLabel && (
          <p
            className={`text-xs shrink-0 ${
              saveStatus === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-black/50 dark:text-white/50"
            }`}
          >
            {statusLabel}
          </p>
        )}
      </div>
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
      {saveError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{saveError}</p>}
      <p className="text-xs text-black/50 dark:text-white/50 mt-2">
        A student counts as a regular in a container when they attended at least this many of its
        events. Changes save automatically for this semester.
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
            const faith = christianGroups(regulars);
            const regularNames = regulars.map(studentDisplayName);
            const summary = regularNames.length > 0 ? regularNames.join(", ") : "No students";
            const years = yearGroups(regulars);
            const yearSummary = [
              ...REGULAR_YEAR_ROWS.map((row) =>
                years[row.year].length
                  ? `${row.label}: ${years[row.year].map(studentDisplayName).join(", ")}`
                  : null
              ),
              years.other.length
                ? `Other: ${years.other.map(studentDisplayName).join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(". ");
            const faithSummary = [
              `Christian: ${faith.christian.map(studentDisplayName).join(", ") || "none"}`,
              `Non-Christian: ${faith.nonChristian.map(studentDisplayName).join(", ") || "none"}`,
              `Unknown: ${faith.unknown.map(studentDisplayName).join(", ") || "none"}`,
            ].join(". ");
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
                <CountCard
                  title={title}
                  caption="Christian"
                  summary={faithSummary}
                  tooltip={<ChristianTooltip groups={faith} />}
                >
                  <ul className="space-y-1 text-sm">
                    <FaithRow label="Christian" count={faith.christian.length} />
                    <FaithRow label="Non-Christian" count={faith.nonChristian.length} />
                    <FaithRow label="Unknown" count={faith.unknown.length} />
                  </ul>
                </CountCard>
                <CountCard
                  title={title}
                  caption="Year"
                  summary={yearSummary || "No students"}
                  tooltip={<YearTooltip groups={years} />}
                >
                  <ul className="space-y-1 text-sm">
                    {REGULAR_YEAR_ROWS.map((row) => (
                      <li key={row.year} className="flex items-baseline justify-between gap-4">
                        <span className="text-black/60 dark:text-white/60">{row.label}</span>
                        <span className="font-semibold tabular-nums">{years[row.year].length}</span>
                      </li>
                    ))}
                    {years.other.length > 0 && (
                      <li className="flex items-baseline justify-between gap-4">
                        <span className="text-black/60 dark:text-white/60">Other</span>
                        <span className="font-semibold tabular-nums">{years.other.length}</span>
                      </li>
                    )}
                  </ul>
                </CountCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FaithRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="font-semibold tabular-nums">{count}</span>
    </li>
  );
}

function ChristianTooltip({ groups }: { groups: ReturnType<typeof christianGroups> }) {
  const sections = [
    { label: "Christian", people: groups.christian },
    { label: "Non-Christian", people: groups.nonChristian },
    { label: "Unknown", people: groups.unknown },
  ].filter((section) => section.people.length > 0);

  if (sections.length === 0) {
    return <p className="text-black/50 dark:text-white/50">No students</p>;
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="font-medium">{section.label}</p>
          <NameList names={section.people.map(studentDisplayName)} />
        </div>
      ))}
    </div>
  );
}

function YearTooltip({ groups }: { groups: ReturnType<typeof yearGroups> }) {
  const sections = [
    ...REGULAR_YEAR_ROWS.map((row) => ({
      label: row.label,
      people: groups[row.year],
    })),
    { label: "Other", people: groups.other },
  ].filter((section) => section.people.length > 0);

  if (sections.length === 0) {
    return <p className="text-black/50 dark:text-white/50">No students</p>;
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="font-medium">{section.label}</p>
          <NameList names={section.people.map(studentDisplayName)} />
        </div>
      ))}
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
