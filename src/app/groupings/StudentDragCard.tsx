"use client";

import Link from "next/link";
import {
  getPrimaryStatusBackground,
  GROUPING_STATUS_LABELS,
  type GroupingStudentStatus,
} from "@/lib/grouping-status";

export type StudentCardData = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  statuses: GroupingStudentStatus[];
};

export default function StudentDragCard({
  student,
  onDragStart,
}: {
  student: StudentCardData;
  onDragStart: (studentId: number) => void;
}) {
  const nameClass =
    student.gender === "M"
      ? "text-blue-700 dark:text-blue-300"
      : student.gender === "F"
        ? "text-red-700 dark:text-red-300"
        : "text-black dark:text-white";

  const backgroundClass = getPrimaryStatusBackground(student.statuses);
  const fullName = `${student.firstName} ${student.lastName ?? ""}`.trim();

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(student.id));
        event.dataTransfer.effectAllowed = "move";
        onDragStart(student.id);
      }}
      className={`rounded-lg border p-2 cursor-grab active:cursor-grabbing shadow-sm ${backgroundClass}`}
    >
      <Link href={`/students/${student.id}`} className={`text-sm font-medium hover:underline ${nameClass}`}>
        {fullName}
      </Link>
      <div className="mt-1 space-y-0.5">
        {student.statuses.map((status) => (
          <p key={status} className="text-xs italic text-black/60 dark:text-white/60">
            {GROUPING_STATUS_LABELS[status]}
          </p>
        ))}
      </div>
    </div>
  );
}
