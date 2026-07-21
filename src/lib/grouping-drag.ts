import type { DragEvent } from "react";

export type GroupingDragSource = "unassigned" | "container";
export type GroupingDragEntity = "student" | "staff";

export type GroupingDragMeta = {
  entity: GroupingDragEntity;
  id: number;
  source: GroupingDragSource;
  containerIndex?: number;
};

export type GroupingContainerDragMeta = {
  fromIndex: number;
};

const MIME = "application/x-grouping-drag";
const CONTAINER_MIME = "application/x-grouping-container-drag";
const CONTAINER_TEXT_PREFIX = "grouping-container:";

export function setGroupingDragData(event: DragEvent, meta: GroupingDragMeta) {
  event.dataTransfer.setData("text/plain", String(meta.id));
  event.dataTransfer.setData(MIME, JSON.stringify(meta));
  event.dataTransfer.effectAllowed = "move";
}

export function readGroupingDragData(event: DragEvent): GroupingDragMeta | null {
  if (isGroupingContainerDrag(event)) return null;

  const raw = event.dataTransfer.getData(MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GroupingDragMeta & { studentId?: number };
      if (parsed.entity && Number.isFinite(parsed.id)) return parsed;
      if (Number.isFinite(parsed.studentId)) {
        return {
          entity: "student",
          id: parsed.studentId as number,
          source: parsed.source ?? "unassigned",
          containerIndex: parsed.containerIndex,
        };
      }
    } catch {
      // fall through
    }
  }

  const plain = event.dataTransfer.getData("text/plain");
  if (plain.startsWith(CONTAINER_TEXT_PREFIX)) return null;
  const id = Number(plain);
  if (!Number.isFinite(id)) return null;
  return { entity: "student", id, source: "unassigned" };
}

export function setGroupingContainerDragData(
  event: DragEvent,
  meta: GroupingContainerDragMeta
) {
  // text/plain prefix works across browsers (Safari often drops custom MIME types).
  event.dataTransfer.setData("text/plain", `${CONTAINER_TEXT_PREFIX}${meta.fromIndex}`);
  try {
    event.dataTransfer.setData(CONTAINER_MIME, JSON.stringify(meta));
  } catch {
    // Some browsers reject custom types; text/plain is enough with React reorder state.
  }
  event.dataTransfer.effectAllowed = "move";
}

export function readGroupingContainerDragData(
  event: DragEvent
): GroupingContainerDragMeta | null {
  const raw = event.dataTransfer.getData(CONTAINER_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GroupingContainerDragMeta;
      if (Number.isFinite(parsed.fromIndex)) return parsed;
    } catch {
      // fall through
    }
  }

  const plain = event.dataTransfer.getData("text/plain");
  if (plain.startsWith(CONTAINER_TEXT_PREFIX)) {
    const fromIndex = Number(plain.slice(CONTAINER_TEXT_PREFIX.length));
    if (Number.isFinite(fromIndex)) return { fromIndex };
  }
  return null;
}

export function isGroupingContainerDrag(event: DragEvent): boolean {
  const { types } = event.dataTransfer;
  if (types.includes(CONTAINER_MIME)) return true;
  // During dragover, getData is often empty; custom MIME may also be missing (Safari).
  // Callers should primarily rely on React/ref reorder-active state.
  return false;
}
