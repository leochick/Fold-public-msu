"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GroupingContainerData, GroupingContainerItem } from "../../../drizzle/schema";
import { updateGroupingAction } from "../groupings-actions";
import type {
  GroupingDetail,
  GroupingEventItem,
  GroupingStaffItem,
  GroupingStudentItem,
} from "@/server/groupings";
import {
  EMPTY_GROUPING_STUDENT_FILTERS,
  studentMatchesFilters,
  type GroupingStudentFilters,
} from "@/lib/grouping-student-filters";
import { readGroupingDragData, type GroupingDragEntity } from "@/lib/grouping-drag";
import ContainerCard from "./ContainerCard";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";
import StaffDragCard, { type StaffCardData } from "./StaffDragCard";
import StudentFiltersCard from "./StudentFiltersCard";

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

function matchesNameSearch(
  person: Pick<StudentCardData | StaffCardData, "firstName" | "lastName">,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const fullName = `${person.firstName} ${person.lastName ?? ""}`.trim().toLowerCase();
  return fullName.includes(normalized);
}

export default function GroupingEditor({
  grouping,
  events,
  students,
  staff,
}: {
  grouping: GroupingDetail;
  events: GroupingEventItem[];
  students: GroupingStudentItem[];
  staff: GroupingStaffItem[];
}) {
  const router = useRouter();
  const [checkedEventIds, setCheckedEventIds] = useState<number[] | null>(grouping.checkedEventIds);
  const [containers, setContainers] = useState<GroupingContainerData[]>(grouping.containers);
  const [studentFilters, setStudentFilters] = useState<GroupingStudentFilters>(
    EMPTY_GROUPING_STUDENT_FILTERS
  );
  const [nameSearch, setNameSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [activeDragEntity, setActiveDragEntity] = useState<GroupingDragEntity | null>(null);
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

  const staffById = useMemo(() => {
    const map = new Map<number, StaffCardData>();
    for (const member of staff) {
      map.set(member.id, {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        gender: member.gender,
      });
    }
    return map;
  }, [staff]);

  const assignedStudentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const container of containers) {
      for (const item of container.items) {
        if (item.entity === "student") ids.add(item.id);
      }
    }
    return ids;
  }, [containers]);

  const assignedStaffIds = useMemo(() => {
    const ids = new Set<number>();
    for (const container of containers) {
      for (const item of container.items) {
        if (item.entity === "staff") ids.add(item.id);
      }
    }
    return ids;
  }, [containers]);

  const eventMatchedStudents = useMemo(
    () => students.filter((student) => studentMatchesEvents(student, checkedEventIds)),
    [students, checkedEventIds]
  );

  const filteredStudents = useMemo(
    () => eventMatchedStudents.filter((student) => studentMatchesFilters(student, studentFilters)),
    [eventMatchedStudents, studentFilters]
  );

  const visibleStudentIds = useMemo(
    () => new Set(filteredStudents.map((student) => student.id)),
    [filteredStudents]
  );

  const unassignedStudents = useMemo(
    () =>
      filteredStudents
        .filter((student) => !assignedStudentIds.has(student.id))
        .map((student) => studentsById.get(student.id)!)
        .filter(Boolean),
    [filteredStudents, assignedStudentIds, studentsById]
  );

  const searchedUnassignedStudents = useMemo(
    () => unassignedStudents.filter((student) => matchesNameSearch(student, nameSearch)),
    [unassignedStudents, nameSearch]
  );

  const unassignedStaff = useMemo(
    () =>
      staff
        .filter((member) => !assignedStaffIds.has(member.id))
        .map((member) => staffById.get(member.id)!)
        .filter(Boolean),
    [staff, assignedStaffIds, staffById]
  );

  const searchedUnassignedStaff = useMemo(
    () => unassignedStaff.filter((member) => matchesNameSearch(member, staffSearch)),
    [unassignedStaff, staffSearch]
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

  function beginDrag(entity: GroupingDragEntity) {
    setActiveDragEntity(entity);
    setDragOverZone(null);
  }

  function endDrag() {
    setActiveDragEntity(null);
  }

  function insertItemAt(containerIndex: number, item: GroupingContainerItem, insertAt: number) {
    setContainers((current) =>
      current.map((container, index) => {
        const fromIndex = container.items.findIndex(
          (row) => row.entity === item.entity && row.id === item.id
        );
        const items = container.items.filter(
          (row) => !(row.entity === item.entity && row.id === item.id)
        );

        if (index !== containerIndex) {
          return { ...container, items };
        }

        let adjustedInsert = insertAt;
        if (fromIndex >= 0 && fromIndex < insertAt) {
          adjustedInsert -= 1;
        }

        const clamped = Math.min(Math.max(adjustedInsert, 0), items.length);
        items.splice(clamped, 0, item);
        return { ...container, items };
      })
    );
  }

  function moveStudentToUnassigned(studentId: number) {
    setContainers((current) =>
      current.map((container) => ({
        ...container,
        items: container.items.filter(
          (item) => !(item.entity === "student" && item.id === studentId)
        ),
      }))
    );
  }

  function moveStaffToUnassigned(staffId: number) {
    setContainers((current) =>
      current.map((container) => ({
        ...container,
        items: container.items.filter(
          (item) => !(item.entity === "staff" && item.id === staffId)
        ),
      }))
    );
  }

  function handleDragStart() {
    setDragOverZone(null);
  }

  function addContainer() {
    setContainers((current) => [...current, { title: "", items: [] }]);
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
        <div className="w-52 shrink-0 space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Students</h2>
            <input
              type="search"
              className="input mb-3"
              placeholder="Search by name"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
              aria-label="Search students by name"
            />
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
                const meta = readGroupingDragData(event);
                if (meta?.entity === "student") {
                  moveStudentToUnassigned(meta.id);
                }
              }}
            >
              {searchedUnassignedStudents.length === 0 ? (
                <p className="text-xs text-black/40 dark:text-white/40 text-center py-4">
                  {unassignedStudents.length === 0
                    ? "No unassigned students"
                    : "No students match your search"}
                </p>
              ) : (
                searchedUnassignedStudents.map((student) => (
                  <StudentDragCard
                    key={student.id}
                    student={student}
                    dragMeta={{ entity: "student", id: student.id, source: "unassigned" }}
                    onDragStart={() => beginDrag("student")}
                    onDragEnd={endDrag}
                  />
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Staff</h2>
            <input
              type="search"
              className="input mb-3"
              placeholder="Search by name"
              value={staffSearch}
              onChange={(event) => setStaffSearch(event.target.value)}
              aria-label="Search staff by name"
            />
            <div
              className={`space-y-2 max-h-[32rem] overflow-y-auto pr-1 min-h-[8rem] rounded-lg border border-dashed p-2 transition-colors ${
                dragOverZone === "unassigned-staff"
                  ? "border-accent/50 bg-accent/5"
                  : "border-transparent"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOverZone("unassigned-staff");
              }}
              onDragLeave={(event) => {
                if (isDragLeave(event.currentTarget, event.relatedTarget)) {
                  setDragOverZone((zone) => (zone === "unassigned-staff" ? null : zone));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverZone(null);
                const meta = readGroupingDragData(event);
                if (meta?.entity === "staff") {
                  moveStaffToUnassigned(meta.id);
                }
              }}
            >
              {searchedUnassignedStaff.length === 0 ? (
                <p className="text-xs text-black/40 dark:text-white/40 text-center py-4">
                  {unassignedStaff.length === 0
                    ? staff.length === 0
                      ? "No staff yet"
                      : "No unassigned staff"
                    : "No staff match your search"}
                </p>
              ) : (
                searchedUnassignedStaff.map((member) => (
                  <StaffDragCard
                    key={member.id}
                    staff={member}
                    dragMeta={{ entity: "staff", id: member.id, source: "unassigned" }}
                    onDragStart={() => beginDrag("staff")}
                    onDragEnd={endDrag}
                  />
                ))
              )}
            </div>
          </div>

          <StudentFiltersCard filters={studentFilters} onChange={setStudentFilters} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {containers.map((container, index) => (
              <ContainerCard
                key={index}
                container={container}
                containerIndex={index}
                studentsById={studentsById}
                staffById={staffById}
                activeDragEntity={activeDragEntity}
                onTitleChange={updateContainerTitle}
                onInsertItemAt={(containerIndex, item, insertAt) => {
                  setDragOverZone(null);
                  insertItemAt(containerIndex, item, insertAt);
                }}
                onDragEntityStart={beginDrag}
                onDragEntityEnd={endDrag}
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
              className="card min-h-[10rem] flex items-center justify-center text-2xl text-black/40 dark:text-white/40 hover:text-accent hover:border-accent/30 transition-colors self-start w-full"
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
