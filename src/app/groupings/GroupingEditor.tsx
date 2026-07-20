"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import {
  areAllNonTablingEventsChecked,
  areAllTablingEventsChecked,
  formatGroupingEventSelection,
  isGroupingEventChecked,
  resolveCheckedEventIdSet,
  studentMatchesGroupingEvents,
  toggleAllNonTablingEvents,
  toggleAllTablingEvents,
  toggleGroupingEvent,
} from "@/lib/grouping-events";
import { readGroupingDragData, type GroupingDragEntity } from "@/lib/grouping-drag";
import type { GroupingExportMember, GroupingExportSnapshot } from "@/lib/grouping-export";
import AssociateRoleModal, { type StaffRoleOption } from "./AssociateRoleModal";
import ContainerCard from "./ContainerCard";
import DeleteContainerModal from "./DeleteContainerModal";
import { useGroupingExport } from "./GroupingExport";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";
import StaffDragCard, { type StaffCardData } from "./StaffDragCard";
import StudentFiltersCard from "./StudentFiltersCard";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

export type StaffRoleEntry = StaffRoleOption & {
  staffId: number;
};

export default function GroupingEditor({
  grouping,
  events,
  students,
  staff,
  staffRoles,
}: {
  grouping: GroupingDetail;
  events: GroupingEventItem[];
  students: GroupingStudentItem[];
  staff: GroupingStaffItem[];
  /** Roles from the view's role board, keyed for each staff member who appears on it. */
  staffRoles: StaffRoleEntry[];
}) {
  const { setSnapshot } = useGroupingExport();
  const [checkedEventIds, setCheckedEventIds] = useState<number[] | null>(grouping.checkedEventIds);
  const [includeNewsletterContacts, setIncludeNewsletterContacts] = useState(
    grouping.includeNewsletterContacts
  );
  const [containers, setContainers] = useState<GroupingContainerData[]>(grouping.containers);
  const [studentFilters, setStudentFilters] = useState<GroupingStudentFilters>(
    EMPTY_GROUPING_STUDENT_FILTERS
  );
  const [nameSearch, setNameSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [activeDragEntity, setActiveDragEntity] = useState<GroupingDragEntity | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [deleteContainerIndex, setDeleteContainerIndex] = useState<number | null>(null);
  const [associateRoleTarget, setAssociateRoleTarget] = useState<{
    containerIndex: number;
    staffId: number;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const latestRef = useRef({
    checkedEventIds,
    includeNewsletterContacts,
    containers,
  });

  latestRef.current = { checkedEventIds, includeNewsletterContacts, containers };

  useEffect(() => {
    skipNextAutosaveRef.current = true;
    setCheckedEventIds(grouping.checkedEventIds);
    setIncludeNewsletterContacts(grouping.includeNewsletterContacts);
    setContainers(grouping.containers);
    setDeleteContainerIndex(null);
    setAssociateRoleTarget(null);
  }, [grouping.id]);

  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    setSaveError(null);

    saveTimerRef.current = setTimeout(() => {
      const snapshot = latestRef.current;
      startTransition(async () => {
        try {
          await updateGroupingAction(
            grouping.id,
            snapshot.checkedEventIds,
            snapshot.containers,
            snapshot.includeNewsletterContacts
          );
          setSaveStatus("saved");
        } catch (error) {
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "Could not save grouping");
        }
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [grouping.id, checkedEventIds, includeNewsletterContacts, containers]);

  const allNonTablingChecked = areAllNonTablingEventsChecked(checkedEventIds, events);
  const allTablingChecked = areAllTablingEventsChecked(checkedEventIds, events);

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

  const studentsFullById = useMemo(() => {
    const map = new Map<number, GroupingStudentItem>();
    for (const student of students) {
      map.set(student.id, student);
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

  const eventNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const event of events) {
      map.set(event.id, event.name);
    }
    return map;
  }, [events]);

  const exportSnapshot = useMemo((): GroupingExportSnapshot => {
    const checkedIds = resolveCheckedEventIdSet(checkedEventIds, events);
    const eventNames = [...checkedIds]
      .map((eventId) => eventNameById.get(eventId))
      .filter((name): name is string => Boolean(name));
    if (includeNewsletterContacts) {
      eventNames.push("Newsletter Contacts");
    }

    return {
      groupingName: grouping.name,
      viewName: grouping.viewName,
      viewFrom: grouping.viewFrom,
      viewTo: grouping.viewTo,
      eventSelectionLabel: formatGroupingEventSelection(checkedEventIds, eventNameById),
      eventNames,
      groups: containers.map((container) => ({
        title: container.title,
        members: container.items.flatMap((item): GroupingExportMember[] => {
          if (item.entity === "student") {
            const student = studentsFullById.get(item.id);
            if (!student) return [];
            return [
              {
                entity: "student",
                firstName: student.firstName,
                lastName: student.lastName,
                gender: student.gender,
                year: student.year,
                statuses: student.statuses,
                courseMaterial: student.courseMaterial,
                newsletter: student.newsletter,
                groupme: student.groupme,
                attendanceCountInRange: student.attendanceCountInRange,
              },
            ];
          }

          const member = staffById.get(item.id);
          if (!member) return [];
          return [
            {
              entity: "staff",
              firstName: member.firstName,
              lastName: member.lastName,
              gender: member.gender,
              year: null,
              statuses: [],
              courseMaterial: null,
              newsletter: null,
              groupme: null,
              attendanceCountInRange: null,
            },
          ];
        }),
      })),
    };
  }, [
    checkedEventIds,
    containers,
    eventNameById,
    events,
    grouping.name,
    grouping.viewFrom,
    grouping.viewName,
    grouping.viewTo,
    includeNewsletterContacts,
    staffById,
    studentsFullById,
  ]);

  useEffect(() => {
    setSnapshot(exportSnapshot);
    return () => setSnapshot(null);
  }, [exportSnapshot, setSnapshot]);

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
    () =>
      students.filter((student) =>
        studentMatchesGroupingEvents({
          attendedEventIds: student.attendedEventIds,
          newsletter: student.newsletter,
          checkedEventIds,
          includeNewsletterContacts,
          events,
        })
      ),
    [students, checkedEventIds, includeNewsletterContacts, events]
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
        .filter((member) => member.activeInView && !assignedStaffIds.has(member.id))
        .map((member) => staffById.get(member.id)!)
        .filter(Boolean),
    [staff, assignedStaffIds, staffById]
  );

  const searchedUnassignedStaff = useMemo(
    () => unassignedStaff.filter((member) => matchesNameSearch(member, staffSearch)),
    [unassignedStaff, staffSearch]
  );

  function toggleAllNonTabling() {
    setCheckedEventIds((current) => toggleAllNonTablingEvents(current, events));
  }

  function toggleTablingContacts() {
    setCheckedEventIds((current) => toggleAllTablingEvents(current, events));
  }

  function toggleEvent(eventId: number) {
    setCheckedEventIds((current) => toggleGroupingEvent(eventId, current, events));
  }

  function isEventChecked(eventId: number) {
    return isGroupingEventChecked(eventId, checkedEventIds, events);
  }

  function beginDrag(entity: GroupingDragEntity) {
    setActiveDragEntity(entity);
    setDragOverZone(null);
  }

  function endDrag() {
    setActiveDragEntity(null);
  }

  function insertItemAt(containerIndex: number, item: GroupingContainerItem, insertAt: number) {
    setContainers((current) => {
      let fromContainerIndex = -1;
      let fromIndex = -1;
      let existing: GroupingContainerItem | undefined;
      for (let index = 0; index < current.length; index += 1) {
        const foundIndex = current[index].items.findIndex(
          (row) => row.entity === item.entity && row.id === item.id
        );
        if (foundIndex >= 0) {
          fromContainerIndex = index;
          fromIndex = foundIndex;
          existing = current[index].items[foundIndex];
          break;
        }
      }

      // Keep role association only when reordering within the same container.
      // Leaving a container (unassigned or another container) clears it.
      const nextItem: GroupingContainerItem =
        item.entity === "staff" &&
        fromContainerIndex === containerIndex &&
        existing?.associatedRoleName
          ? {
              entity: "staff",
              id: item.id,
              associatedRoleName: existing.associatedRoleName,
            }
          : { entity: item.entity, id: item.id };

      return current.map((container, index) => {
        const items = container.items.filter(
          (row) => !(row.entity === item.entity && row.id === item.id)
        );

        if (index !== containerIndex) {
          return { ...container, items };
        }

        let adjustedInsert = insertAt;
        if (fromContainerIndex === containerIndex && fromIndex >= 0 && fromIndex < insertAt) {
          adjustedInsert -= 1;
        }

        const clamped = Math.min(Math.max(adjustedInsert, 0), items.length);
        items.splice(clamped, 0, nextItem);
        return { ...container, items };
      });
    });
  }

  function associateStaffRole(containerIndex: number, staffId: number, roleName: string) {
    const trimmed = roleName.trim();
    if (!trimmed) return;
    setContainers((current) =>
      current.map((container, index) => {
        if (index !== containerIndex) return container;
        return {
          ...container,
          items: container.items.map((item) =>
            item.entity === "staff" && item.id === staffId
              ? { entity: "staff", id: staffId, associatedRoleName: trimmed }
              : item
          ),
        };
      })
    );
    setAssociateRoleTarget(null);
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
    setAssociateRoleTarget((current) =>
      current?.staffId === staffId ? null : current
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

  function removeContainer(index: number) {
    setContainers((current) => current.filter((_, containerIndex) => containerIndex !== index));
    setDeleteContainerIndex(null);
    setAssociateRoleTarget((current) => {
      if (!current) return null;
      if (current.containerIndex === index) return null;
      if (current.containerIndex > index) {
        return { ...current, containerIndex: current.containerIndex - 1 };
      }
      return current;
    });
  }

  const statusLabel =
    saveStatus === "saving" || isPending
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : null;

  const pendingDeleteContainer =
    deleteContainerIndex != null ? containers[deleteContainerIndex] : null;

  const associateStaff = associateRoleTarget
    ? staffById.get(associateRoleTarget.staffId) ?? null
    : null;
  const associateStaffName = associateStaff
    ? `${associateStaff.firstName} ${associateStaff.lastName ?? ""}`.trim()
    : "";
  const associateRoles = associateRoleTarget
    ? staffRoles.filter((role) => role.staffId === associateRoleTarget.staffId)
    : [];
  const currentAssociatedRole =
    associateRoleTarget != null
      ? containers[associateRoleTarget.containerIndex]?.items.find(
          (item) => item.entity === "staff" && item.id === associateRoleTarget.staffId
        )?.associatedRoleName
      : undefined;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold">
            {grouping.eventAndStudentDataViewName
              ? `${grouping.viewName}: Event data from "${grouping.eventAndStudentDataViewName}"`
              : `Events in ${grouping.viewName}`}
          </h2>
          {statusLabel && (
            <p
              className={`text-xs shrink-0 ${
                saveStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {statusLabel}
            </p>
          )}
        </div>
        {saveError && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">{saveError}</p>
        )}
        <p className="text-xs text-black/60 dark:text-white/60 mb-3">
          Changes save automatically.
        </p>
        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeNewsletterContacts}
              onChange={() => setIncludeNewsletterContacts((current) => !current)}
            />
            <span>Newsletter Contacts</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allTablingChecked}
              onChange={toggleTablingContacts}
            />
            <span>Tabling Contacts</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allNonTablingChecked}
              onChange={toggleAllNonTabling}
            />
            <span>All Non-Tabling Events</span>
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
                visibleStudentIds={visibleStudentIds}
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
                onRequestDelete={setDeleteContainerIndex}
                onAssociateStaffRole={(containerIndex, staffId) =>
                  setAssociateRoleTarget({ containerIndex, staffId })
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

      {pendingDeleteContainer != null && deleteContainerIndex != null && (
        <DeleteContainerModal
          containerTitle={pendingDeleteContainer.title}
          onConfirm={() => removeContainer(deleteContainerIndex)}
          onClose={() => setDeleteContainerIndex(null)}
        />
      )}

      {associateRoleTarget != null && associateStaff && (
        <AssociateRoleModal
          staffName={associateStaffName}
          roles={associateRoles}
          currentRoleName={currentAssociatedRole}
          onConfirm={(roleName) =>
            associateStaffRole(
              associateRoleTarget.containerIndex,
              associateRoleTarget.staffId,
              roleName
            )
          }
          onClose={() => setAssociateRoleTarget(null)}
        />
      )}
    </div>
  );
}
