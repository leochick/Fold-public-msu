import { db } from "@/lib/db";
import { students } from "../../drizzle/schema";
import { or, and, eq } from "drizzle-orm";

export async function C101Widget() {
  // Fetch all active or engaged students (using lowercase strings matching schema definition)
  const allTargetStudents = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      email: students.email,
      funnelStage: students.funnelStage,
      courseMaterial: students.courseMaterial,
    })
    .from(students)
    .where(
      or(
        eq(students.funnelStage, "active"),
        eq(students.funnelStage, "engaged")
      )
    );

  // Filter students into the two distinct widget sets based on the course_material JSON data
  const completedStudents = allTargetStudents.filter((student) => {
    const materials = student.courseMaterial as string[] | null;
    return Array.isArray(materials) && materials.includes("C101");
  });

  const pendingStudents = allTargetStudents.filter((student) => {
    const materials = student.courseMaterial as string[] | null;
    return !Array.isArray(materials) || !materials.includes("C101");
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 mt-6">
      {/* List 1: Taken Course 101 */}
      <div className="card space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Completed Course 101</h3>
            <span className="chip bg-green-500/10 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded">
              {completedStudents.length} Students
            </span>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50 mt-1">
            Active and Engaged students who have completed C101.
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pr-2">
          {completedStudents.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">
              No students have taken C101 yet.
            </p>
          ) : (
            completedStudents.map((student) => (
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
              {pendingStudents.length} Missing
            </span>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50 mt-1">
            Active and Engaged students missing this prerequisite.
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 pr-2">
          {pendingStudents.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40 py-4 italic text-center">
              All active and engaged students are up to date!
            </p>
          ) : (
            pendingStudents.map((student) => (
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
  );
}
