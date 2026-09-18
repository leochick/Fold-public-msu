"use client";

import { useMemo, useState } from "react";
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
  buildAttendanceTrendsChart,
  type AttendanceTrendGender,
  type AttendanceTrendYear,
  type AttendanceTrendsFilters,
} from "@/lib/attendance-trends";
import type { AttendanceTrendsPayload } from "@/server/attendance-trends";
import CheckboxDropdown from "./CheckboxDropdown";

const LINE_COLORS = [
  "#7c3aed",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#f97316",
];

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
          <ResponsiveContainer width="100%" height={420}>
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
                labelFormatter={(week) => `Week ${week}`}
                formatter={(value, name) => [value ?? "—", name]}
              />
              <Legend />
              {chart.series.map((series, index) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
