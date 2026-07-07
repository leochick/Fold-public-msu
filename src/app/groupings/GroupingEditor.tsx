"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GroupingContainerData } from "../../../drizzle/schema";
import { updateGroupingAction } from "../groupings-actions";
import type {
  GroupingDetail,
  GroupingEventItem,
  GroupingStudentItem,
} from "@/server/groupings";
import ContainerCard from "./ContainerCard";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";

function studentMatchesEvents(
  student: GroupingStudentItem,
  checkedEventIds: number[] | null
): boolean {
  if (checkedEventIds === null) return student.attendedEventIds.length > 0;
  if (checkedEventIds.length === 0) return false;
  return checkedEventIds.some((eventId) => student.attendedEventIds.includes(eventId));
}

function isDragLeave(currentTarget: EventTarget & Element, relatedTarget: EventTarget | null) {
  if (!relatedTarget || !(relatedTarget instanceof Node)) return true;
  return !currentTarget.contains(relatedTarget);
}

export default function GroupingEditor({
  grouping,
  events,
  students,
}: {
  grouping: GroupingDetail;
  events: GroupingEventItem[];
  students: GroupingStudentItem[];
}) {
  const router = useRouter();
  const [checkedEventIds, setCheckedEventIds] = useState<number[] | null>(grouping.checkedEventIds);
  const [containers, setContainers] = useState<GroupingContainerData[]>(grouping.containers);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allChecked = checkedEventIds === null;

  const studentsById = useMemo(() => {
    const map = new Map<number, StudentCardData>();
    for (const student of students) {
      map.set(student.id, {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        statuses: student.statuses,
      });
    }
    return map;
  }, [students]);

  const assignedStudentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const container of containers) {
      for (const studentId of container.studentIds) {
        ids.add(studentId);
      }
    }
    return ids;
  }, [containers]);

  const visibleStudents = useMemo(
    () => students.filter((student) => studentMatchesEvents(student, checkedEventIds)),
    [students, checkedEventIds]
  );

  const unassignedStudents = useMemo(
    () =>
      visibleStudents
        .filter((student) => !assignedStudentIds.has(student.id))
        .map((student) => studentsById.get(student.id)!)
        .filter(Boolean),
    [visibleStudents, assignedStudentIds, studentsById]
  );

  function toggleAll() {
    setCheckedEventIds((current) => (current === null ? [] : null));
  }

  function toggleEvent(eventId: number) {
    setCheckedEventIds((current) => {
      if (current === null) {
        return events.map((event) => event.id).filter((id) => id !== eventId);
      }
      if (current.includes(eventId)) {
        return current.filter((id) => id !== eventId);
      }
      const next = [...current, eventId];
      if (next.length === events.length) return null;
      return next;
    });
  }

  function isEventChecked(eventId: number) {
    return allChecked || (checkedEventIds?.includes(eventId) ?? false);
  }

  function moveStudentToContainer(containerIndex: number, studentId: number) {
    setContainers((current) =>
      current.map((container, index) => {
        const withoutStudent = container.studentIds.filter((id) => id !== studentId);
        if (index === containerIndex) {
          return { ...container, studentIds: [...withoutStudent, studentId] };
        }
        return { ...container, studentIds: withoutStudent };
      })
    );
  }

  function moveStudentToUnassigned(studentId: number) {
    setContainers((current) =>
      current.map((container) => ({
        ...container,
        studentIds: container.studentIds.filter((id) => id !== studentId),
      }))
    );
  }

  function handleDragStart() {
    setDragOverZone(null);
  }

  function addContainer() {
    setContainers((current) => [...current, { title: "", studentIds: [] }]);
  }

  function updateContainerTitle(index: number, title: string) {
    setContainers((current) =>
      current.map((container, containerIndex) =>
        containerIndex === index ? { ...container, title } : container
      )
    );
  }

  function saveGrouping() {
    setSaveError(null);
    startTransition(async () => {
      try {
        await updateGroupingAction(grouping.id, checkedEventIds, containers);
        router.refresh();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save grouping");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-sm font-semibold mb-3">Events in {grouping.viewName}</h2>
        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allChecked}
              onChange={toggleAll}
            />
            <span>All</span>
          </label>
          {events.map((event) => (
            <label key={event.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isEventChecked(event.id)}
                onChange={() => toggleEvent(event.id)}
              />
              <span>
                {event.name}
                {event.type ? (
                  <span className="text-black/50 dark:text-white/50"> ({event.type})</span>
                ) : null}
              </span>
            </label>
          ))}
          {events.length === 0 && (
            <p className="text-xs text-black/50 dark:text-white/50">
              No events in this view&apos;s date range.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start min-w-0">
        <div className="w-52 shrink-0">
          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Students</h2>
            <div
              className={`space-y-2 max-h-[32rem] overflow-y-auto pr-1 min-h-[8rem] rounded-lg border border-dashed p-2 transition-colors ${
                dragOverZone === "unassigned"
                  ? "border-accent/50 bg-accent/5"
                  : "border-transparent"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOverZone("unassigned");
              }}
              onDragLeave={(event) => {
                if (isDragLeave(event.currentTarget, event.relatedTarget)) {
                  setDragOverZone((zone) => (zone === "unassigned" ? null : zone));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverZone(null);
                const studentId = Number(event.dataTransfer.getData("text/plain"));
                if (Number.isFinite(studentId)) {
                  moveStudentToUnassigned(studentId);
                }
              }}
            >
              {unassignedStudents.length === 0 ? (
                <p className="text-xs text-black/40 dark:text-white/40 text-center py-4">
                  No unassigned students
                </p>
              ) : (
                unassignedStudents.map((student) => (
                  <StudentDragCard
                    key={student.id}
                    student={student}
                    onDragStart={handleDragStart}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {containers.map((container, index) => (
              <ContainerCard
                key={index}
                container={container}
                containerIndex={index}
                studentsById={studentsById}
                onTitleChange={updateContainerTitle}
                onDropStudent={(containerIndex, studentId) => {
                  setDragOverZone(null);
                  moveStudentToContainer(containerIndex, studentId);
                }}
                onDragStart={handleDragStart}
                isDragOver={dragOverZone === `container-${index}`}
                onDragEnter={() => setDragOverZone(`container-${index}`)}
                onDragLeave={() =>
                  setDragOverZone((zone) => (zone === `container-${index}` ? null : zone))
                }
              />
            ))}
            <button
              type="button"
              className="card min-h-[10rem] flex items-center justify-center text-2xl text-black/40 dark:text-white/40 hover:text-accent hover:border-accent/30 transition-colors"
              onClick={addContainer}
              aria-label="Add container"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveGrouping}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save Grouping"}
        </button>
        {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
      </div>
    </div>
  );
}
