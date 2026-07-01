"use client";

import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

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

      <div className="card lg:col-span-2 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Completed Course 101</h3>
            <span className="chip bg-green-500/10 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded">
              {completedC101.length} Students
            </span>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50 mt-1">
            Students with attendance in {rangeLabel} who have completed C101.
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pr-2">
          {completedC101.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">
              No students have taken C101 yet.
            </p>
          ) : (
            completedC101.map((student) => (
              <div key={student.id} className="py-2.5 flex flex-col justify-center">
                <span className="text-sm font-medium">
                  {`${student.firstName} ${student.lastName ?? ""}`.trim()}
                </span>
                {student.email && (
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {student.email}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card lg:col-span-2 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Should Take Course 101</h3>
            <span className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs px-2 py-0.5 rounded">
              {pendingC101.length} Missing
            </span>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50 mt-1">
            Active (1+ visit) and Engaged (3+ visits) in {rangeLabel} missing this prerequisite.
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pr-2">
          {pendingC101.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">
              All active and engaged students are up to date!
            </p>
          ) : (
            pendingC101.map((student) => (
              <div key={student.id} className="py-2.5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {`${student.firstName} ${student.lastName ?? ""}`.trim()}
                  </span>
                  {student.email && (
                    <span className="text-xs text-black/40 dark:text-white/40">
                      {student.email}
                    </span>
                  )}
                </div>
                <span className="chip text-xs px-2 py-0.5 bg-black/5 dark:bg-white/5 uppercase tracking-wider font-mono text-[10px]">
                  {student.engagementStage}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <AttendeeFlagList
        title="Not on Newsletter"
        description={`Students with attendance in ${rangeLabel} who are not subscribed to the newsletter.`}
        countLabel={`${notOnNewsletter.length} Missing`}
        chipClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        students={notOnNewsletter}
        emptyMessage="Everyone who attended in this view is on the newsletter."
      />

      <AttendeeFlagList
        title="Not in Groupme"
        description={`Students with attendance in ${rangeLabel} who are not in Groupme.`}
        countLabel={`${notOnGroupme.length} Missing`}
        chipClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        students={notOnGroupme}
        emptyMessage="Everyone who attended in this view is in Groupme."
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

function AttendeeFlagList({
  title,
  description,
  countLabel,
  chipClass,
  students,
  emptyMessage,
}: {
  title: string;
  description: string;
  countLabel: string;
  chipClass: string;
  students: AttendeeListStudent[];
  emptyMessage: string;
}) {
  return (
    <div className="card lg:col-span-2 space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{title}</h3>
          <span className={`chip ${chipClass} text-xs px-2 py-0.5 rounded`}>{countLabel}</span>
        </div>
        <p className="text-xs text-black/50 dark:text-white/50 mt-1">{description}</p>
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pr-2">
        {students.length === 0 ? (
          <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">{emptyMessage}</p>
        ) : (
          students.map((student) => (
            <Link
              key={student.id}
              href={`/students/${student.id}`}
              className="py-2.5 flex flex-col justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition"
            >
              <span className="text-sm font-medium">
                {`${student.firstName} ${student.lastName ?? ""}`.trim()}
              </span>
              {student.email && (
                <span className="text-xs text-black/40 dark:text-white/40">{student.email}</span>
              )}
            </Link>
          ))
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
