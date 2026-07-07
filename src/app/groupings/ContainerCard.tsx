"use client";

import { useState } from "react";
import type { GroupingContainerData } from "../../../drizzle/schema";
import { readGroupingDragData } from "@/lib/grouping-drag";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";

function isDragLeave(currentTarget: EventTarget & Element, relatedTarget: EventTarget | null) {
  if (!relatedTarget || !(relatedTarget instanceof Node)) return true;
  return !currentTarget.contains(relatedTarget);
}

export default function ContainerCard({
  container,
  containerIndex,
  studentsById,
  visibleStudentIds,
  onTitleChange,
  onDropStudent,
  onDropOnStudent,
  onDragStart,
  isDragOver,
  onDragEnter,
  onDragLeave,
}: {
  container: GroupingContainerData;
  containerIndex: number;
  studentsById: Map<number, StudentCardData>;
  visibleStudentIds: Set<number>;
  onTitleChange: (index: number, title: string) => void;
  onDropStudent: (containerIndex: number, studentId: number) => void;
  onDropOnStudent: (containerIndex: number, targetStudentId: number, draggedStudentId: number) => void;
  onDragStart: (studentId: number) => void;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
}) {
  const [reorderTargetId, setReorderTargetId] = useState<number | null>(null);

  const containerStudents = container.studentIds
    .map((id) => studentsById.get(id))
    .filter((student): student is StudentCardData => Boolean(student))
    .filter((student) => visibleStudentIds.has(student.id));

  return (
    <div className="card min-h-[10rem] flex flex-col">
      <input
        type="text"
        className="input mb-3"
        placeholder="Container title"
        value={container.title}
        onChange={(event) => onTitleChange(containerIndex, event.target.value)}
      />
      <div
        className={`flex-1 rounded-lg border border-dashed p-2 space-y-2 min-h-[6rem] transition-colors ${
          isDragOver
            ? "border-accent/50 bg-accent/5"
            : "border-black/10 dark:border-white/15"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragEnter();
        }}
        onDragLeave={(event) => {
          if (isDragLeave(event.currentTarget, event.relatedTarget)) {
            onDragLeave();
            setReorderTargetId(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragLeave();
          setReorderTargetId(null);
          const meta = readGroupingDragData(event);
          if (!meta) return;
          onDropStudent(containerIndex, meta.studentId);
        }}
      >
        {containerStudents.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40 text-center py-4">
            Drop students here
          </p>
        ) : (
          containerStudents.map((student) => (
            <StudentDragCard
              key={student.id}
              student={student}
              dragMeta={{ studentId: student.id, source: "container", containerIndex }}
              onDragStart={() => {
                setReorderTargetId(null);
                onDragStart(student.id);
              }}
              isReorderTarget={reorderTargetId === student.id}
              onDragEnterCard={(targetStudentId) => setReorderTargetId(targetStudentId)}
              onDropOnCard={(targetStudentId, draggedStudentId) => {
                setReorderTargetId(null);
                onDropOnStudent(containerIndex, targetStudentId, draggedStudentId);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
