"use client";

import Link from "next/link";
import {
  getPrimaryStatusBackground,
  GROUPING_STATUS_LABELS,
  type GroupingStudentStatus,
} from "@/lib/grouping-status";
import { readGroupingDragData, setGroupingDragData, type GroupingDragMeta } from "@/lib/grouping-drag";

export type StudentCardData = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  statuses: GroupingStudentStatus[];
};

export default function StudentDragCard({
  student,
  dragMeta,
  onDragStart,
  onDropOnCard,
  onDragEnterCard,
  isReorderTarget,
}: {
  student: StudentCardData;
  dragMeta: GroupingDragMeta;
  onDragStart: (studentId: number) => void;
  onDropOnCard?: (targetStudentId: number, draggedStudentId: number) => void;
  onDragEnterCard?: (targetStudentId: number) => void;
  isReorderTarget?: boolean;
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
        setGroupingDragData(event, dragMeta);
        onDragStart(student.id);
      }}
      onDragEnter={(event) => {
        if (!onDropOnCard) return;
        event.preventDefault();
        event.stopPropagation();
        onDragEnterCard?.(student.id);
      }}
      onDragOver={(event) => {
        if (!onDropOnCard) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!onDropOnCard) return;
        event.preventDefault();
        event.stopPropagation();
        const meta = readGroupingDragData(event);
        if (!meta || meta.studentId === student.id) return;
        onDropOnCard(student.id, meta.studentId);
      }}
      className={`rounded-lg border p-2 cursor-grab active:cursor-grabbing shadow-sm ${backgroundClass} ${
        isReorderTarget ? "ring-2 ring-accent/50 border-accent/40" : ""
      }`}
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
