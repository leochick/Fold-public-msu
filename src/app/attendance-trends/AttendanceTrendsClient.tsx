"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ATTENDANCE_TREND_GENDERS,
  ATTENDANCE_TREND_YEARS,
  EMPTY_ATTENDANCE_TRENDS_FILTERS,
  attendanceTrendIncompleteKey,
  buildAttendanceTrendsChart,
  splitAttendanceTooltipColumns,
  type AttendanceTrendChartEvent,
  type AttendanceTrendGender,
  type AttendanceTrendSeries,
  type AttendanceTrendYear,
  type AttendanceTrendsChartPoint,
  type AttendanceTrendsFilters,
} from "@/lib/attendance-trends";
import type { AttendanceTrendsPayload } from "@/server/attendance-trends";
import CheckboxDropdown from "./CheckboxDropdown";

const INCOMPLETE_POINT_COLOR = "#dc2626";
const INCOMPLETE_POINT_LEGEND =
  "Red points mean that student data is not fully captured for reported events.";

const LINE_COLORS = [
  "#7c3aed",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#f97316",
];

function formatTrendEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type AttendanceTooltipRow = {
  key: string;
  label: string;
  value: number;
  color: string;
  events: AttendanceTrendChartEvent[];
};

type AttendanceTooltipBlock =
  | { kind: "header"; key: string; row: AttendanceTooltipRow }
  | { kind: "event"; key: string; event: AttendanceTrendChartEvent };

function tooltipBlocks(rows: AttendanceTooltipRow[]): AttendanceTooltipBlock[] {
  const blocks: AttendanceTooltipBlock[] = [];
  for (const row of rows) {
    blocks.push({ kind: "header", key: `header-${row.key}`, row });
    for (const event of row.events) {
      blocks.push({ kind: "event", key: `event-${event.id}`, event });
    }
  }
  return blocks;
}

function TooltipYearHeader({ row, spread = true }: { row: AttendanceTooltipRow; spread?: boolean }) {
  return (
    <div className={spread ? "flex items-baseline justify-between gap-4" : "flex items-baseline gap-2"}>
      <span className="font-medium" style={{ color: row.color }}>
        {row.label}
      </span>
      <span className="tabular-nums">{row.value}</span>
    </div>
  );
}

function TooltipEventLine({ event }: { event: AttendanceTrendChartEvent }) {
  return (
    <div className="text-black/70 dark:text-white/70">
      <span className="text-black dark:text-white">{event.name}</span>
      <span className="block">
        {formatTrendEventDate(event.startDate)}
        {event.type ? ` · ${event.type}` : ""}
      </span>
    </div>
  );
}

function AttendanceTrendsTooltipBody({
  week,
  rows,
}: {
  week: number;
  rows: AttendanceTooltipRow[];
}) {
  const contentKey = `${week}:${rows
    .map((row) => `${row.key}:${row.events.map((event) => event.id).join(",")}`)
    .join("|")}`;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ key: contentKey, columns: 1 as 1 | 2 });

  if (layout.key !== contentKey) {
    setLayout({ key: contentKey, columns: 1 });
  }

  const columns = layout.key === contentKey ? layout.columns : 1;
  const blocks = tooltipBlocks(rows);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || columns !== 1) return;

    const measure = () => {
      if (el.clientHeight === 0 || blocks.length < 2) return;
      if (el.scrollHeight > el.clientHeight + 1) {
        setLayout({ key: contentKey, columns: 2 });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [blocks.length, columns, contentKey]);

  const [leftColumn, rightColumn] = splitAttendanceTooltipColumns(blocks);

  return (
    <div
      ref={scrollerRef}
      className={
        columns === 2
          ? "w-[36rem] max-w-[calc(100vw-1.5rem)] overflow-visible rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-neutral-900"
          : "max-h-72 max-w-sm overflow-y-auto rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-neutral-900"
      }
    >
      <p className="font-semibold">Week {week}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-black/50 dark:text-white/50">No events this week.</p>
      ) : columns === 2 ? (
        <div className="mt-2 grid grid-cols-2 items-start gap-x-5">
          {[leftColumn, rightColumn].map((column, index) => (
            <div key={index} className="space-y-1">
              {column.map((block, blockIndex) =>
                block.kind === "header" ? (
                  <div key={block.key} className={blockIndex === 0 ? undefined : "pt-2"}>
                    <TooltipYearHeader row={block.row} spread={false} />
                  </div>
                ) : (
                  <TooltipEventLine key={block.key} event={block.event} />
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {rows.map((row) => (
            <div key={row.key}>
              <TooltipYearHeader row={row} />
              {row.events.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {row.events.map((event) => (
                    <li key={event.id}>
                      <TooltipEventLine event={event} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TrendDotProps = {
  cx?: number;
  cy?: number;
  stroke?: string;
  value?: unknown;
  payload?: AttendanceTrendsChartPoint;
};

function TrendPointDot({
  cx,
  cy,
  stroke,
  value,
  payload,
  incompleteKey,
  active = false,
}: {
  cx?: number;
  cy?: number;
  stroke?: string;
  value?: unknown;
  payload?: AttendanceTrendsChartPoint;
  incompleteKey: string;
  active?: boolean;
}) {
  if (typeof cx !== "number" || typeof cy !== "number" || typeof value !== "number") {
    return <g />;
  }
  const incomplete = payload?.[incompleteKey] === true;
  const radius = incomplete ? (active ? 6 : 4.5) : active ? 5 : 3;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={incomplete ? INCOMPLETE_POINT_COLOR : stroke}
      stroke={incomplete ? "#171717" : stroke}
      strokeWidth={incomplete ? 1.5 : 1}
    />
  );
}

function AttendanceChartLegend({
  payload,
}: {
  payload?: ReadonlyArray<{ value?: string; color?: string; dataKey?: unknown }>;
}) {
  return (
    <div className="pt-1 text-center text-xs">
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {(payload ?? []).map((entry) => (
          <li key={String(entry.dataKey ?? entry.value)} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span>{entry.value}</span>
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-2 flex max-w-xl items-start justify-center gap-2 text-black/60 dark:text-white/60">
        <span
          className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-neutral-900 dark:border-white"
          style={{ backgroundColor: INCOMPLETE_POINT_COLOR }}
          aria-hidden
        />
        <span>{INCOMPLETE_POINT_LEGEND}</span>
      </p>
    </div>
  );
}

function AttendanceTrendsTooltip({
  active,
  label,
  payload,
  series,
  eventsBySeries,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: unknown }>;
  series: AttendanceTrendSeries[];
  eventsBySeries: Record<string, AttendanceTrendChartEvent[][]>;
}) {
  if (!active || label == null || label === "") return null;
  const week = Number(label);
  if (!Number.isFinite(week)) return null;

  const rows = series.flatMap((entry, index) => {
    const match = payload?.find((item) => item.dataKey === entry.key);
    const value = typeof match?.value === "number" ? match.value : null;
    if (value == null) return [];
    return [
      {
        key: entry.key,
        label: entry.label,
        value,
        color: LINE_COLORS[index % LINE_COLORS.length],
        events: eventsBySeries[entry.key]?.[week] ?? [],
      },
    ];
  });

  return <AttendanceTrendsTooltipBody week={week} rows={rows} />;
}

export default function AttendanceTrendsClient({
  payload,
}: {
  payload: AttendanceTrendsPayload;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<AttendanceTrendsFilters>(EMPTY_ATTENDANCE_TRENDS_FILTERS);
  const seasonLabel = payload.season === "fall" ? "Fall" : "Spring";

  const chart = useMemo(() => {
    return buildAttendanceTrendsChart({
      semesters: payload.semesters.map((semester) => ({
        academicYearId: semester.academicYearId,
        yearName: semester.yearName,
        season: semester.season,
        semester: {
          newStudentsMoveIn: null,
          classesBegin: semester.classesBegin,
          classesEnd: semester.classesEnd,
          finalExamsStart: null,
          finalExamsEnd: semester.finalExamsEnd,
          holidays: [],
        },
      })),
      events: payload.events.map((event) => ({
        id: event.id,
        name: event.name,
        startDate: new Date(event.startDate),
        type: event.type,
        totalStudents: event.totalStudents,
      })),
      records: payload.records,
      filters,
    });
  }, [payload, filters]);

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CheckboxDropdown
            label="Semester"
            required
            multiple={false}
            options={[
              { value: "fall", label: "Fall" },
              { value: "spring", label: "Spring" },
            ]}
            selected={[payload.season]}
            onChange={(next) => {
              const season = next[0] === "spring" ? "spring" : "fall";
              router.push(`/attendance-trends?semester=${season}`);
            }}
          />
          <CheckboxDropdown
            label="Event Type"
            options={payload.eventTypes.map((type) => ({ value: type, label: type }))}
            selected={filters.eventTypes}
            onChange={(eventTypes) => setFilters((current) => ({ ...current, eventTypes }))}
          />
          <CheckboxDropdown
            label="Gender"
            options={ATTENDANCE_TREND_GENDERS}
            selected={filters.genders}
            onChange={(genders) =>
              setFilters((current) => ({
                ...current,
                genders: genders as AttendanceTrendGender[],
              }))
            }
          />
          <CheckboxDropdown
            label="Year"
            options={ATTENDANCE_TREND_YEARS}
            selected={filters.years}
            onChange={(years) =>
              setFilters((current) => ({
                ...current,
                years: years as AttendanceTrendYear[],
              }))
            }
          />
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-1">Attendance</h2>
        <p className="text-xs text-black/50 dark:text-white/50 mb-4">
          Weekly {seasonLabel} attendance across years. Week 1 starts the Sunday of classes begin.
        </p>
        {chart.series.length === 0 ? (
          <div className="h-[360px] flex items-center justify-center text-sm text-black/40 dark:text-white/40">
            {payload.semesters.length === 0 ? (
              <p>
                No {seasonLabel} semesters with a classes-begin date yet. Add dates in{" "}
                <Link href="/academic-calendar" className="underline">
                  Academic Calendar
                </Link>
                .
              </p>
            ) : (
              <p>No {seasonLabel} attendance data yet.</p>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={460}>
            <LineChart data={chart.points} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="week"
                tickFormatter={(week) => `Week ${week}`}
                interval={0}
                fontSize={11}
              />
              <YAxis
                width={64}
                fontSize={11}
                allowDecimals={false}
                label={{ value: "Attendance", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
              />
              <Tooltip
                content={
                  <AttendanceTrendsTooltip
                    series={chart.series}
                    eventsBySeries={chart.eventsBySeries}
                  />
                }
              />
              <Legend content={<AttendanceChartLegend />} />
              {chart.series.map((series, index) => {
                const incompleteKey = attendanceTrendIncompleteKey(series.key);
                return (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={LINE_COLORS[index % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={(dotProps: TrendDotProps) => (
                      <TrendPointDot {...dotProps} incompleteKey={incompleteKey} />
                    )}
                    activeDot={(dotProps: TrendDotProps) => (
                      <TrendPointDot {...dotProps} incompleteKey={incompleteKey} active />
                    )}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
