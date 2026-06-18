"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

interface DashboardStudent {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
  funnelStage: "new" | "reaching_out" | "connected" | "met" | "active" | "engaged" | "inactive";
}

interface DashboardChartsProps {
  overTime: any; // update with your exact type definitions
  funnel: any;
  breakdowns: any;
  completedC101: DashboardStudent[];
  pendingC101: DashboardStudent[];
}

export default function DashboardCharts({
  overTime,
  funnel,
  breakdowns,
  completedC101,
  pendingC101,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h3 className="font-semibold mb-2">Attendance over time</h3>
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

      {/* Course 101 Widget Section within DashboardCharts */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        
        {/* List 1: Completed Course 101 */}
        <div className="card space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Completed Course 101</h3>
              <span className="chip bg-green-500/10 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded">
                {completedC101.length} Students
              </span>
            </div>
            <p className="text-xs text-black/50 dark:text-white/50 mt-1">
              Active and Engaged students who have completed C101.
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

        {/* List 2: Should Take Course 101 */}
        <div className="card space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Should Take Course 101</h3>
              <span className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs px-2 py-0.5 rounded">
                {pendingC101.length} Missing
              </span>
            </div>
            <p className="text-xs text-black/50 dark:text-white/50 mt-1">
              Active and Engaged students missing this prerequisite.
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
                    {student.funnelStage}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card lg:col-span-2">
        <h3 className="font-semibold mb-2">Breakdowns</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PieMini title="By year" data={breakdowns.year} />
          <PieMini title="By gender" data={breakdowns.gender} />
          <PieMini title="By event type" data={breakdowns.eventType} />
        </div>
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
