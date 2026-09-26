"use client";

import { useState, type DragEvent } from "react";
import type { GroupingContainerData, GroupingContainerItem } from "../../../drizzle/schema";
import { readGroupingDragData, type GroupingDragEntity } from "@/lib/grouping-drag";
import { countContainerItems, GROUPING_CONTAINER_DAYS } from "@/lib/grouping-containers";
import DropContainerCard from "@/components/drop-board/DropContainerCard";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";
import StaffDragCard, { type StaffCardData } from "./StaffDragCard";

export default function ContainerCard({
  container,
  containerIndex,
  studentsById,
  staffById,
  visibleStudentIds,
  activeDragEntity,
  onTitleChange,
  onLocationChange,
  onTimeChange,
  onInsertItemAt,
  onDragEntityStart,
  onDragEntityEnd,
  onDragStart,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onRequestDelete,
  onAssociateStaffRole,
  spouseDayConflictStaffIds,
  hasSpouseDayConflict,
  childcareConflictStaffIds,
  hasChildcareConflict,
  isContainerDragging,
  isContainerReorderActive,
  onContainerReorderDragStart,
  onContainerReorderDragOver,
  onContainerReorderDrop,
  onContainerReorderDragEnd,
}: {
  container: GroupingContainerData;
  containerIndex: number;
  studentsById: Map<number, StudentCardData>;
  staffById: Map<number, StaffCardData>;
  visibleStudentIds: Set<number>;
  activeDragEntity: GroupingDragEntity | null;
  onTitleChange: (index: number, title: string) => void;
  onLocationChange: (index: number, location: string) => void;
  onTimeChange: (index: number, time: string) => void;
  onInsertItemAt: (containerIndex: number, item: GroupingContainerItem, insertAt: number) => void;
  onDragEntityStart: (entity: GroupingDragEntity) => void;
  onDragEntityEnd: () => void;
  onDragStart: () => void;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onRequestDelete: (index: number) => void;
  onAssociateStaffRole: (containerIndex: number, staffId: number) => void;
  spouseDayConflictStaffIds: Set<number>;
  hasSpouseDayConflict: boolean;
  childcareConflictStaffIds: Set<number>;
  hasChildcareConflict: boolean;
  isContainerDragging: boolean;
  /** May read a ref — call inside event handlers so dragover works before re-render. */
  isContainerReorderActive: () => boolean;
  onContainerReorderDragStart: (index: number) => void;
  onContainerReorderDragOver: (index: number, insertBefore: boolean) => void;
  onContainerReorderDrop: () => void;
  onContainerReorderDragEnd: () => void;
}) {
  const [editingLocation, setEditingLocation] = useState(false);
  const [editingTime, setEditingTime] = useState(false);

  const showLocationInput = editingLocation || Boolean(container.location?.trim());
  const showTimeInput = editingTime || Boolean(container.time?.trim());
  const { students: studentCount, staff: staffCount } = countContainerItems(container.items);

  function isItemVisible(item: GroupingContainerItem) {
    return item.entity === "staff" || visibleStudentIds.has(item.id);
  }

  function beginItemDrag(entity: GroupingDragEntity, beginItemDragState: () => void) {
    beginItemDragState();
    onDragEntityStart(entity);
    onDragStart();
    onDragEnter();
  }

  function handleDropItem(event: DragEvent<HTMLDivElement>, insertAt: number) {
    const meta = readGroupingDragData(event);
    if (!meta) return false;
    onDragEntityEnd();
    onInsertItemAt(containerIndex, { entity: meta.entity, id: meta.id }, insertAt);
    return true;
  }

  return (
    <DropContainerCard
      title={container.title}
      containerIndex={containerIndex}
      items={container.items}
      itemKey={(item) => `${item.entity}-${item.id}`}
      isItemVisible={isItemVisible}
      activeDrag={activeDragEntity !== null}
      emptyLabel="Drop students or staff here"
      isDragOver={isDragOver}
      onTitleChange={(title) => onTitleChange(containerIndex, title)}
      onRequestDelete={() => onRequestDelete(containerIndex)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDropItem={handleDropItem}
      isContainerDragging={isContainerDragging}
      isContainerReorderActive={isContainerReorderActive}
      onContainerReorderDragStart={onContainerReorderDragStart}
      onContainerReorderDragOver={onContainerReorderDragOver}
      onContainerReorderDrop={onContainerReorderDrop}
      onContainerReorderDragEnd={onContainerReorderDragEnd}
      headerExtra={
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {showLocationInput ? (
            <input
              type="text"
              className="input flex-1 min-w-[6rem] text-xs py-1"
              placeholder="Location"
              aria-label={`Location for ${container.title.trim() || `container ${containerIndex + 1}`}`}
              value={container.location ?? ""}
              autoFocus={editingLocation}
              onChange={(event) => onLocationChange(containerIndex, event.target.value)}
              onBlur={() => {
                if (!container.location?.trim()) setEditingLocation(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="btn-ghost px-1.5 py-0.5 text-xs leading-none text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70"
              onClick={() => setEditingLocation(true)}
            >
              + Loc
            </button>
          )}
          {showTimeInput ? (
            <select
              className={`input flex-1 min-w-[8rem] text-xs py-1 ${
                hasSpouseDayConflict || hasChildcareConflict
                  ? "!border-dotted !border-red-500 dark:!border-red-400 focus:!ring-red-500/40"
                  : ""
              }`}
              aria-label={`Day for ${container.title.trim() || `container ${containerIndex + 1}`}`}
              aria-invalid={hasSpouseDayConflict || hasChildcareConflict || undefined}
              value={container.time ?? ""}
              autoFocus={editingTime}
              onChange={(event) => onTimeChange(containerIndex, event.target.value)}
              onBlur={() => {
                if (!container.time?.trim()) setEditingTime(false);
              }}
            >
              <option value="">Day</option>
              {GROUPING_CONTAINER_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              className="btn-ghost px-1.5 py-0.5 text-xs leading-none text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70"
              onClick={() => setEditingTime(true)}
            >
              + Day
            </button>
          )}
        </div>
      }
      footer={
        <p className="mt-2 text-xs text-black/50 dark:text-white/50 text-center">
          {studentCount} {studentCount === 1 ? "student" : "students"}
          {staffCount > 0 && (
            <>
              {" · "}
              {staffCount} {staffCount === 1 ? "staff" : "staff"}
            </>
          )}
        </p>
      }
      renderItem={(item, index, api) => {
        if (item.entity === "staff") {
          const member = staffById.get(item.id);
          if (!member) return null;
          return (
            <div className="relative z-10">
              <StaffDragCard
                staff={member}
                dragMeta={{ entity: "staff", id: item.id, source: "container", containerIndex }}
                onDragStart={() => beginItemDrag("staff", api.beginItemDrag)}
                onDragEnd={onDragEntityEnd}
                onDragEnterCard={(insertBefore) => api.hoverItem(insertBefore)}
                associatedRoleName={item.associatedRoleName}
                onAssociateWithRole={() => onAssociateStaffRole(containerIndex, item.id)}
                hasSpouseDayConflict={spouseDayConflictStaffIds.has(item.id)}
                hasChildcareConflict={childcareConflictStaffIds.has(item.id)}
              />
            </div>
          );
        }

        const student = studentsById.get(item.id);
        if (!student) return null;
        return (
          <div className="relative z-10">
            <StudentDragCard
              student={student}
              dragMeta={{ entity: "student", id: item.id, source: "container", containerIndex }}
              onDragStart={() => beginItemDrag("student", api.beginItemDrag)}
              onDragEnd={onDragEntityEnd}
              onDragEnterCard={(insertBefore) => api.hoverItem(insertBefore)}
            />
          </div>
        );
      }}
    />
  );
}
