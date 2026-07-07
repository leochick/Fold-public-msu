"use client";

import type { GroupingContainerData } from "../../../drizzle/schema";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";

export default function ContainerCard({
  container,
  containerIndex,
  studentsById,
  onTitleChange,
  onDropStudent,
  onDragStart,
  isDragOver,
  onDragEnter,
  onDragLeave,
}: {
  container: GroupingContainerData;
  containerIndex: number;
  studentsById: Map<number, StudentCardData>;
  onTitleChange: (index: number, title: string) => void;
  onDropStudent: (containerIndex: number, studentId: number) => void;
  onDragStart: (studentId: number) => void;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
}) {
  const containerStudents = container.studentIds
    .map((id) => studentsById.get(id))
    .filter((student): student is StudentCardData => Boolean(student));

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
        onDragLeave={onDragLeave}
        onDrop={(event) => {
          event.preventDefault();
          const raw = event.dataTransfer.getData("text/plain");
          const studentId = Number(raw);
          if (Number.isFinite(studentId)) {
            onDropStudent(containerIndex, studentId);
          }
        }}
      >
        {containerStudents.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40 text-center py-4">
            Drop students here
          </p>
        ) : (
          containerStudents.map((student) => (
            <StudentDragCard key={student.id} student={student} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  );
}
