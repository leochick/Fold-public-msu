"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import ContainerInsertGap from "@/components/drop-board/ContainerInsertGap";
import {
  createContainerKey,
  dropInsertToIndex,
  remapIndexAfterReorder,
  reorderList,
  shouldShowContainerInsertGap,
} from "@/lib/container-board";
import { isDragLeave } from "@/lib/drag-leave";
import {
  groupEventsByType,
  insertEvent,
  normalizeMinimumAttendance,
  removeEvent,
  type RegularsContainer,
  type RegularsPayload,
} from "@/lib/regulars";
import { readRegularsDragData } from "@/lib/regulars-drag";
import { saveRegularsBoardAction } from "../regulars-actions";
import DeleteContainerModal from "../groupings/DeleteContainerModal";
import EventDragCard from "./EventDragCard";
import RegularsContainerCard from "./RegularsContainerCard";
import RegularsMetrics from "./RegularsMetrics";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function RegularsEditor({ payload }: { payload: RegularsPayload }) {
  const [minimumInput, setMinimumInput] = useState(() => String(payload.minimumAttendance));
  const [containers, setContainers] = useState<RegularsContainer[]>(payload.containers);
  const [containerKeys, setContainerKeys] = useState<string[]>(() =>
    payload.containers.map(() => createContainerKey())
  );
  const [activeDrag, setActiveDrag] = useState(false);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [containerDragFromIndex, setContainerDragFromIndex] = useState<number | null>(null);
  const [containerDropInsertIndex, setContainerDropInsertIndex] = useState<number | null>(null);
  const containerDragFromIndexRef = useRef<number | null>(null);
  const containerDropInsertIndexRef = useRef<number | null>(null);
  const [deleteContainerIndex, setDeleteContainerIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);

  const parsedMinimum = /^\d+$/.test(minimumInput)
    ? normalizeMinimumAttendance(minimumInput)
    : null;
  const appliedMinimumRef = useRef(payload.minimumAttendance);
  if (parsedMinimum != null) appliedMinimumRef.current = parsedMinimum;
  const latestRef = useRef({ containers, minimum: appliedMinimumRef.current });
  latestRef.current = { containers, minimum: appliedMinimumRef.current };

  useEffect(() => {
    if (parsedMinimum == null) return;
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
          await saveRegularsBoardAction(
            payload.semesterId,
            snapshot.minimum,
            snapshot.containers
          );
          setSaveStatus("saved");
        } catch (error) {
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "Could not save regulars");
        }
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [payload.semesterId, containers, parsedMinimum]);

  const eventsById = useMemo(
    () => new Map(payload.events.map((event) => [event.id, event])),
    [payload.events]
  );

  const assignedEventIds = useMemo(() => {
    const ids = new Set<number>();
    for (const container of containers) {
      for (const eventId of container.eventIds) ids.add(eventId);
    }
    return ids;
  }, [containers]);

  const unassignedEvents = useMemo(
    () => payload.events.filter((event) => !assignedEventIds.has(event.id)),
    [payload.events, assignedEventIds]
  );

  function beginDrag() {
    clearContainerReorderState();
    setActiveDrag(true);
    setDragOverZone(null);
  }

  function endDrag() {
    setActiveDrag(false);
  }

  function addContainer() {
    setContainers((current) => [...current, { title: "", eventIds: [] }]);
    setContainerKeys((current) => [...current, createContainerKey()]);
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
    setContainerKeys((current) => current.filter((_, containerIndex) => containerIndex !== index));
    setDeleteContainerIndex(null);
  }

  function autoPopulate() {
    const next = groupEventsByType(payload.events);
    setContainers(next);
    setContainerKeys(next.map(() => createContainerKey()));
    setDeleteContainerIndex(null);
    clearContainerReorderState();
  }

  function clearContainerReorderState() {
    containerDragFromIndexRef.current = null;
    containerDropInsertIndexRef.current = null;
    setContainerDragFromIndex(null);
    setContainerDropInsertIndex(null);
  }

  function beginContainerReorder(fromIndex: number) {
    setActiveDrag(false);
    setDragOverZone(null);
    containerDragFromIndexRef.current = fromIndex;
    containerDropInsertIndexRef.current = fromIndex;
    setContainerDragFromIndex(fromIndex);
    setContainerDropInsertIndex(fromIndex);
  }

  function setContainerReorderInsertIndex(nextInsert: number) {
    if (containerDropInsertIndexRef.current === nextInsert) return;
    containerDropInsertIndexRef.current = nextInsert;
    setContainerDropInsertIndex(nextInsert);
  }

  function reorderContainers(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setContainers((current) => reorderList(current, fromIndex, toIndex));
    setContainerKeys((current) => reorderList(current, fromIndex, toIndex));
    setDeleteContainerIndex((current) =>
      current == null ? null : remapIndexAfterReorder(current, fromIndex, toIndex)
    );
  }

  function commitContainerReorder() {
    const fromIndex = containerDragFromIndexRef.current;
    const dropInsertIndex = containerDropInsertIndexRef.current;
    if (fromIndex == null || dropInsertIndex == null) {
      clearContainerReorderState();
      return;
    }
    reorderContainers(fromIndex, dropInsertToIndex(fromIndex, dropInsertIndex));
    clearContainerReorderState();
  }

  function onMinimumInputChange(value: string) {
    if (value === "" || /^\d+$/.test(value)) setMinimumInput(value);
  }

  function onMinimumBlur() {
    setMinimumInput(String(appliedMinimumRef.current));
  }

  const showContainerInsertGap = shouldShowContainerInsertGap(
    containerDragFromIndex,
    containerDropInsertIndex
  );
  const isContainerReorderActive = containerDragFromIndex != null;
  const pendingDeleteContainer =
    deleteContainerIndex != null ? containers[deleteContainerIndex] : null;

  return (
    <div className="space-y-6">
      <RegularsMetrics
        containers={containers}
        containerKeys={containerKeys}
        students={payload.students}
        attendances={payload.attendances}
        minimumInput={minimumInput}
        minimum={appliedMinimumRef.current}
        onMinimumInputChange={onMinimumInputChange}
        onMinimumBlur={onMinimumBlur}
        saveStatus={saveStatus}
        saveError={saveError}
      />

      <div className="flex gap-4 items-start min-w-0">
        <div className="w-72 shrink-0">
          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Events</h2>
            <button
              type="button"
              className="btn btn-primary w-full whitespace-normal text-center leading-snug mb-3 disabled:opacity-50"
              onClick={autoPopulate}
              disabled={payload.events.length === 0}
            >
              Auto-populate by Event Type
            </button>
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
                const meta = readRegularsDragData(event);
                if (meta) setContainers((current) => removeEvent(current, meta.id));
              }}
            >
              {unassignedEvents.length === 0 ? (
                <p className="text-xs text-black/40 dark:text-white/40 text-center py-4">
                  {payload.events.length === 0
                    ? "No events in this semester"
                    : "No unassigned events"}
                </p>
              ) : (
                unassignedEvents.map((event) => (
                  <EventDragCard
                    key={event.id}
                    event={event}
                    dragMeta={{ id: event.id, source: "unassigned" }}
                    onDragStart={beginDrag}
                    onDragEnd={endDrag}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {containers.map((container, index) => {
              const showInsertBefore =
                showContainerInsertGap && containerDropInsertIndex === index;
              const showInsertAfter =
                showContainerInsertGap &&
                containerDropInsertIndex === containers.length &&
                index === containers.length - 1;

              return (
                <div key={containerKeys[index] ?? `fallback-${index}`} className="relative min-w-0">
                  <ContainerInsertGap
                    show={showInsertBefore}
                    edge="before"
                    active={isContainerReorderActive}
                    onDragOver={() => {
                      if (containerDragFromIndexRef.current == null) return;
                      setContainerReorderInsertIndex(index);
                    }}
                    onDrop={commitContainerReorder}
                  />
                  <RegularsContainerCard
                    container={container}
                    containerIndex={index}
                    eventsById={eventsById}
                    activeDrag={activeDrag}
                    onTitleChange={updateContainerTitle}
                    onInsertEventAt={(containerIndex, eventId, insertAt) => {
                      setDragOverZone(null);
                      setContainers((current) =>
                        insertEvent(current, containerIndex, eventId, insertAt)
                      );
                    }}
                    onDragStart={beginDrag}
                    onDragEnd={endDrag}
                    isDragOver={dragOverZone === `container-${index}`}
                    onDragEnter={() => setDragOverZone(`container-${index}`)}
                    onDragLeave={() =>
                      setDragOverZone((zone) => (zone === `container-${index}` ? null : zone))
                    }
                    onRequestDelete={setDeleteContainerIndex}
                    isContainerDragging={containerDragFromIndex === index}
                    isContainerReorderActive={() => containerDragFromIndexRef.current != null}
                    onContainerReorderDragStart={beginContainerReorder}
                    onContainerReorderDragOver={(overIndex, insertBefore) => {
                      if (containerDragFromIndexRef.current == null) return;
                      setContainerReorderInsertIndex(insertBefore ? overIndex : overIndex + 1);
                    }}
                    onContainerReorderDrop={commitContainerReorder}
                    onContainerReorderDragEnd={clearContainerReorderState}
                  />
                  {index === containers.length - 1 && (
                    <ContainerInsertGap
                      show={showInsertAfter}
                      edge="after"
                      active={isContainerReorderActive}
                      onDragOver={() => {
                        if (containerDragFromIndexRef.current == null) return;
                        setContainerReorderInsertIndex(containers.length);
                      }}
                      onDrop={commitContainerReorder}
                    />
                  )}
                </div>
              );
            })}
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
          detail="Events in this container will return to the Events list."
          onConfirm={() => removeContainer(deleteContainerIndex)}
          onClose={() => setDeleteContainerIndex(null)}
        />
      )}
    </div>
  );
}
