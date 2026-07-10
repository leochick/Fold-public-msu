"use client";

import { Fragment, useRef, useState, type DragEvent } from "react";
import type { GroupingContainerData, GroupingContainerItem } from "../../../drizzle/schema";
import { readGroupingDragData, type GroupingDragEntity } from "@/lib/grouping-drag";
import { countContainerItems } from "@/lib/grouping-containers";
import StudentDragCard, { type StudentCardData } from "./StudentDragCard";
import StaffDragCard, { type StaffCardData } from "./StaffDragCard";
import InsertionGap from "./InsertionGap";

function isDragLeave(currentTarget: EventTarget & Element, relatedTarget: EventTarget | null) {
  if (!relatedTarget || !(relatedTarget instanceof Node)) return true;
  return !currentTarget.contains(relatedTarget);
}

export default function ContainerCard({
  container,
  containerIndex,
  studentsById,
  staffById,
  visibleStudentIds,
  activeDragEntity,
  onTitleChange,
  onInsertItemAt,
  onDragEntityStart,
  onDragEntityEnd,
  onDragStart,
  isDragOver,
  onDragEnter,
  onDragLeave,
}: {
  container: GroupingContainerData;
  containerIndex: number;
  studentsById: Map<number, StudentCardData>;
  staffById: Map<number, StaffCardData>;
  visibleStudentIds: Set<number>;
  activeDragEntity: GroupingDragEntity | null;
  onTitleChange: (index: number, title: string) => void;
  onInsertItemAt: (containerIndex: number, item: GroupingContainerItem, insertAt: number) => void;
  onDragEntityStart: (entity: GroupingDragEntity) => void;
  onDragEntityEnd: () => void;
  onDragStart: () => void;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
}) {
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const insertAtIndexRef = useRef<number | null>(null);

  const { students: studentCount, staff: staffCount } = countContainerItems(container.items);

  function isItemVisible(item: GroupingContainerItem) {
    return item.entity === "staff" || visibleStudentIds.has(item.id);
  }

  const hasVisibleItems = container.items.some(isItemVisible);
  const isEmpty = container.items.length === 0;

  function setInsertion(index: number) {
    if (insertAtIndexRef.current === index) return;
    insertAtIndexRef.current = index;
    setInsertAtIndex(index);
  }

  function clearInsertion() {
    if (insertAtIndexRef.current === null) return;
    insertAtIndexRef.current = null;
    setInsertAtIndex(null);
  }

  function handleContainerDragStart(entity: GroupingDragEntity) {
    onDragEntityStart(entity);
    clearInsertion();
    onDragStart();
    onDragEnter();
  }

  function handleContainerDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const meta = readGroupingDragData(event);
    if (!meta) return;

    const insertAt = insertAtIndexRef.current ?? container.items.length;
    onDragEntityEnd();
    clearInsertion();
    onDragLeave();

    onInsertItemAt(containerIndex, { entity: meta.entity, id: meta.id }, insertAt);
  }

  function showGap(index: number) {
    return activeDragEntity !== null && insertAtIndex === index;
  }

  function handleCardHover(index: number, insertBefore: boolean) {
    setInsertion(insertBefore ? index : index + 1);
  }

  function renderItem(item: GroupingContainerItem, index: number) {
    if (item.entity === "staff") {
      const member = staffById.get(item.id);
      if (!member) return null;
      return (
        <div className="relative z-10">
          <StaffDragCard
            staff={member}
            dragMeta={{ entity: "staff", id: item.id, source: "container", containerIndex }}
            onDragStart={() => handleContainerDragStart("staff")}
            onDragEnd={onDragEntityEnd}
            onDragEnterCard={(insertBefore) => handleCardHover(index, insertBefore)}
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
          onDragStart={() => handleContainerDragStart("student")}
          onDragEnd={onDragEntityEnd}
          onDragEnterCard={(insertBefore) => handleCardHover(index, insertBefore)}
        />
      </div>
    );
  }

  function renderGap(index: number) {
    return (
      <InsertionGap
        key={`gap-${index}`}
        show={showGap(index)}
        onDragEnter={() => setInsertion(index)}
      />
    );
  }

  return (
    <div className="card min-h-[10rem] w-full self-start isolate">
      <input
        type="text"
        className="input mb-3"
        placeholder="Container title"
        value={container.title}
        onChange={(event) => onTitleChange(containerIndex, event.target.value)}
      />
      <div
        className={`rounded-lg border border-dashed p-2 min-h-[6rem] transition-colors ${
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
          if (isEmpty && activeDragEntity) {
            setInsertion(0);
          }
        }}
        onDragLeave={(event) => {
          if (isDragLeave(event.currentTarget, event.relatedTarget)) {
            onDragLeave();
            clearInsertion();
          }
        }}
        onDropCapture={handleContainerDrop}
      >
        {!hasVisibleItems && (
          <p className="text-xs text-black/40 dark:text-white/40 text-center py-4 pointer-events-none">
            Drop students or staff here
          </p>
        )}

        {renderGap(0)}
        {container.items.map((item, index) => {
          if (!isItemVisible(item)) return null;
          return (
            <Fragment key={`${item.entity}-${item.id}`}>
              {renderItem(item, index)}
              {renderGap(index + 1)}
            </Fragment>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-black/50 dark:text-white/50 text-center">
        {studentCount} {studentCount === 1 ? "student" : "students"}
        {staffCount > 0 && (
          <>
            {" · "}
            {staffCount} {staffCount === 1 ? "staff" : "staff"}
          </>
        )}
      </p>
    </div>
  );
}
