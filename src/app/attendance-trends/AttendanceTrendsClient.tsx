"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ATTENDANCE_TREND_GENDERS,
  ATTENDANCE_TREND_YEARS,
  EMPTY_ATTENDANCE_TRENDS_FILTERS,
  attendanceTrendIncompleteKey,
  buildAttendanceTrendsChart,
  type AttendanceTrendChartEvent,
  type AttendanceTrendGender,
  type AttendanceTrendYear,
  type AttendanceTrendsChartPoint,
  type AttendanceTrendsFilters,
} from "@/lib/attendance-trends";
import type { AttendanceTrendsPayload } from "@/server/attendance-trends";
import CheckboxDropdown from "./CheckboxDropdown";

const INCOMPLETE_POINT_COLOR = "#dc2626";
const INCOMPLETE_POINT_LEGEND =
  "Red points - Events do not have fully captured student data. Total count may contain duplicated students.";

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

type AttendancePointRow = {
  key: string;
  label: string;
  value: number;
  color: string;
  events: AttendanceTrendChartEvent[];
};

type SelectedTrendPoint = {
  seriesKey: string;
  week: number;
  clientX: number;
  clientY: number;
};

function TooltipYearHeader({ row }: { row: AttendancePointRow }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-medium" style={{ color: row.color }}>
        {row.label}
      </span>
      <span className="tabular-nums">{row.value}</span>
    </div>
  );
}

function TooltipEventLine({ event }: { event: AttendanceTrendChartEvent }) {
  const incomplete = event.studentDataIncomplete;
  const text = incomplete ? "text-red-600 dark:text-red-400" : "text-black dark:text-white";
  const meta = incomplete ? "text-red-600/80 dark:text-red-400/80" : "text-black/70 dark:text-white/70";
  return (
    <Link href={`/events/${event.id}`} className={`block rounded-sm ${text}`}>
      <span className="hover:underline">{event.name}</span>
      <span className={`block no-underline ${meta}`}>
        {formatTrendEventDate(event.startDate)}
        {event.type ? ` · ${event.type}` : ""}
      </span>
    </Link>
  );
}

function placePointPopover(clientX: number, clientY: number, width: number, height: number) {
  const margin = 8;
  const offset = 12;
  let left = clientX + offset;
  let top = clientY + offset;
  if (left + width > window.innerWidth - margin) left = clientX - width - offset;
  if (top + height > window.innerHeight - margin) top = clientY - height - offset;
  return {
    left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
  };
}

function YearPointPopover({
  week,
  row,
  clientX,
  clientY,
  onClose,
}: {
  week: number;
  row: AttendancePointRow;
  clientX: number;
  clientY: number;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const contentKey = `${week}:${row.key}:${row.events.map((event) => event.id).join(",")}`;

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(placePointPopover(clientX, clientY, rect.width, rect.height));
  }, [clientX, clientY, contentKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-trend-point]")) return;
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${row.label}, week ${week}`}
      className="fixed z-50 max-h-72 max-w-sm overflow-y-auto rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-neutral-900"
      style={{
        left: position?.left ?? clientX + 12,
        top: position?.top ?? clientY + 12,
        visibility: position ? "visible" : "hidden",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Week {week}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm leading-none text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="mt-2">
        <TooltipYearHeader row={row} />
        {row.events.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {row.events.map((event) => (
              <li key={event.id}>
                <TooltipEventLine event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-black/50 dark:text-white/50">No events this week.</p>
        )}
      </div>
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
  seriesKey,
  selected = false,
  onSelect,
}: {
  cx?: number;
  cy?: number;
  stroke?: string;
  value?: unknown;
  payload?: AttendanceTrendsChartPoint;
  incompleteKey: string;
  seriesKey: string;
  selected?: boolean;
  onSelect: (point: SelectedTrendPoint) => void;
}) {
  if (typeof cx !== "number" || typeof cy !== "number" || typeof value !== "number") {
    return <g />;
  }
  const week = payload?.week;
  const incomplete = payload?.[incompleteKey] === true;
  const radius = incomplete ? (selected ? 6 : 4.5) : selected ? 5 : 3;
  return (
    <g
      data-trend-point=""
      style={{ cursor: "pointer" }}
      onClick={(event) => {
        event.stopPropagation();
        if (typeof week !== "number") return;
        onSelect({ seriesKey, week, clientX: event.clientX, clientY: event.clientY });
      }}
    >
      <circle cx={cx} cy={cy} r={10} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={incomplete ? INCOMPLETE_POINT_COLOR : stroke}
        stroke={incomplete ? "#171717" : stroke}
        strokeWidth={incomplete ? 1.5 : 1}
      />
    </g>
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

export default function AttendanceTrendsClient({
  payload,
}: {
  payload: AttendanceTrendsPayload;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<AttendanceTrendsFilters>(EMPTY_ATTENDANCE_TRENDS_FILTERS);
  const [selectedPoint, setSelectedPoint] = useState<SelectedTrendPoint | null>(null);
  const seasonLabel = payload.season === "fall" ? "Fall" : "Spring";

  function changeFilters(patch: Partial<AttendanceTrendsFilters>) {
    setSelectedPoint(null);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function selectPoint(next: SelectedTrendPoint) {
    setSelectedPoint((current) =>
      current && current.seriesKey === next.seriesKey && current.week === next.week ? null : next
    );
  }

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

  const selectedDetail = useMemo(() => {
    if (!selectedPoint) return null;
    const index = chart.series.findIndex((entry) => entry.key === selectedPoint.seriesKey);
    const entry = chart.series[index];
    if (!entry) return null;
    const value = chart.points[selectedPoint.week]?.[entry.key];
    if (typeof value !== "number") return null;
    const row: AttendancePointRow = {
      key: entry.key,
      label: entry.label,
      value,
      color: LINE_COLORS[index % LINE_COLORS.length],
      events: chart.eventsBySeries[entry.key]?.[selectedPoint.week] ?? [],
    };
    return {
      week: selectedPoint.week,
      clientX: selectedPoint.clientX,
      clientY: selectedPoint.clientY,
      row,
    };
  }, [chart, selectedPoint]);

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
            onChange={(eventTypes) => changeFilters({ eventTypes })}
          />
          <CheckboxDropdown
            label="Gender"
            options={ATTENDANCE_TREND_GENDERS}
            selected={filters.genders}
            onChange={(genders) => changeFilters({ genders: genders as AttendanceTrendGender[] })}
          />
          <CheckboxDropdown
            label="Year"
            options={ATTENDANCE_TREND_YEARS}
            selected={filters.years}
            onChange={(years) => changeFilters({ years: years as AttendanceTrendYear[] })}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-1">Attendance</h2>
        <p className="text-xs text-black/50 dark:text-white/50 mb-4">
          Weekly {seasonLabel} attendance across years. Week 1 starts the Sunday of classes begin.
          Click a point to see that year's events.
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
                    isAnimationActive={false}
                    dot={(dotProps: TrendDotProps & { key?: string | number }) => {
                      const { key, ...pointProps } = dotProps;
                      return (
                        <TrendPointDot
                          key={key}
                          {...pointProps}
                          incompleteKey={incompleteKey}
                          seriesKey={series.key}
                          selected={
                            selectedPoint?.seriesKey === series.key &&
                            selectedPoint.week === dotProps.payload?.week
                          }
                          onSelect={selectPoint}
                        />
                      );
                    }}
                    activeDot={false}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
        {selectedDetail && (
          <YearPointPopover
            week={selectedDetail.week}
            row={selectedDetail.row}
            clientX={selectedDetail.clientX}
            clientY={selectedDetail.clientY}
            onClose={() => setSelectedPoint(null)}
          />
        )}
      </section>
    </div>
  );
}
