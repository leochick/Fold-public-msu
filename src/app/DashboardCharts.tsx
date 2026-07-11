"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ENGAGEMENT_STAGE_LABELS } from "@/lib/dashboard-engagement";

const COLORS = ["#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

interface CompletedC101Student {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
}

interface PendingC101Student extends CompletedC101Student {
  engagementStage: "active" | "engaged";
}

interface AttendeeListStudent {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
}

interface DashboardChartsProps {
  overTime: any; // update with your exact type definitions
  funnel: any;
  breakdowns: any;
  completedC101: CompletedC101Student[];
  pendingC101: PendingC101Student[];
  notOnNewsletter: AttendeeListStudent[];
  notOnGroupme: AttendeeListStudent[];
  rangeLabel: string;
}

export default function DashboardCharts({
  overTime,
  funnel,
  breakdowns,
  completedC101,
  pendingC101,
  notOnNewsletter,
  notOnGroupme,
  rangeLabel,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="font-semibold mb-2">Attendance over time</h3>
        <p className="text-xs text-black/50 mb-2">{rangeLabel}</p>
        {overTime.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={overTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Engagement funnel</h3>
        <p className="text-xs text-black/50 mb-2">{rangeLabel}</p>
        {funnel.every((f:any) => f.count === 0) ? <Empty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="stage" fontSize={11} width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <SearchableStudentList
        title="Completed or Taking Course 101"
        description={`Students with attendance in ${rangeLabel} who have completed or are taking C101.`}
        countLabel={`${completedC101.length} Students`}
        chipClass="bg-green-500/10 text-green-600 dark:text-green-400"
        students={completedC101}
        emptyMessage="No students have taken C101 yet."
      />

      <SearchableStudentList
        title="Should Take Course 101"
        description={`${ENGAGEMENT_STAGE_LABELS.active} and ${ENGAGEMENT_STAGE_LABELS.engaged} in ${rangeLabel} missing this prerequisite.`}
        countLabel={`${pendingC101.length} Missing`}
        chipClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        students={pendingC101}
        emptyMessage="All active and engaged students are up to date!"
        renderTrailing={(student) =>
          "engagementStage" in student ? (
            <span className="chip text-xs px-2 py-0.5 bg-black/5 dark:bg-white/5 tracking-wider font-mono text-[10px]">
              {ENGAGEMENT_STAGE_LABELS[(student as PendingC101Student).engagementStage]}
            </span>
          ) : null
        }
        rowClassName="flex items-center justify-between"
      />

      <SearchableStudentList
        title="Not on Newsletter"
        description={`Students with attendance in ${rangeLabel} who are not subscribed to the newsletter.`}
        countLabel={`${notOnNewsletter.length} Missing`}
        chipClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        students={notOnNewsletter}
        emptyMessage="Everyone who attended in this view is on the newsletter."
        linkToStudent
      />

      <SearchableStudentList
        title="Not in Groupme"
        description={`Students with attendance in ${rangeLabel} who are not in Groupme.`}
        countLabel={`${notOnGroupme.length} Missing`}
        chipClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        students={notOnGroupme}
        emptyMessage="Everyone who attended in this view is in Groupme."
        linkToStudent
      />

      <div className="card lg:col-span-2">
        <h3 className="font-semibold mb-2">Breakdowns</h3>
        <p className="text-xs text-black/50 mb-2">{rangeLabel}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PieMini title="By year" data={breakdowns.year} />
          <PieMini title="By gender" data={breakdowns.gender} />
          <PieMini title="By event type" data={breakdowns.eventType} />
        </div>
      </div>
    </div>
  );
}

function formatStudentName(student: AttendeeListStudent) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function studentMatchesQuery(student: AttendeeListStudent, query: string) {
  const haystack = [
    student.firstName,
    student.lastName ?? "",
    formatStudentName(student),
    student.email ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function SearchableStudentList({
  title,
  description,
  countLabel,
  chipClass,
  students,
  emptyMessage,
  linkToStudent = false,
  rowClassName = "flex flex-col justify-center",
  renderTrailing,
}: {
  title: string;
  description: string;
  countLabel: string;
  chipClass: string;
  students: AttendeeListStudent[];
  emptyMessage: string;
  linkToStudent?: boolean;
  rowClassName?: string;
  renderTrailing?: (student: AttendeeListStudent) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      normalizedQuery
        ? students.filter((student) => studentMatchesQuery(student, normalizedQuery))
        : students,
    [students, normalizedQuery]
  );

  const countDisplay =
    normalizedQuery && students.length > 0
      ? `${filtered.length} of ${students.length}`
      : countLabel;

  const rowContent = (student: AttendeeListStudent) => (
    <>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium">{formatStudentName(student)}</span>
        {student.email && (
          <span className="text-xs text-black/40 dark:text-white/40 truncate">{student.email}</span>
        )}
      </div>
      {renderTrailing?.(student)}
    </>
  );

  return (
    <div className="card lg:col-span-2 space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-lg">{title}</h3>
          <span className={`chip ${chipClass} text-xs px-2 py-0.5 rounded shrink-0`}>{countDisplay}</span>
        </div>
        <p className="text-xs text-black/50 dark:text-white/50 mt-1">{description}</p>
      </div>

      {students.length > 0 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names or email…"
          className="input text-sm py-1.5"
          aria-label={`Search ${title}`}
        />
      )}

      <div className="max-h-64 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pr-2">
        {students.length === 0 ? (
          <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">{emptyMessage}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">
            No matches for &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          filtered.map((student) =>
            linkToStudent ? (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className={`py-2.5 ${rowClassName} hover:bg-black/[0.03] dark:hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition`}
              >
                {rowContent(student)}
              </Link>
            ) : (
              <div key={student.id} className={`py-2.5 ${rowClassName}`}>
                {rowContent(student)}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

function PieMini({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div>
      <div className="text-xs text-black/60 text-center mb-1">{title}</div>
      {data.length === 0 ? <Empty /> : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={60} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Empty() {
  return <div className="h-[200px] flex items-center justify-center text-xs text-black/40">no data yet</div>;
}
