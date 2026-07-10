import type { DragEvent } from "react";

export type GroupingDragSource = "unassigned" | "container";
export type GroupingDragEntity = "student" | "staff";

export type GroupingDragMeta = {
  entity: GroupingDragEntity;
  id: number;
  source: GroupingDragSource;
  containerIndex?: number;
};

const MIME = "application/x-grouping-drag";

export function setGroupingDragData(event: DragEvent, meta: GroupingDragMeta) {
  event.dataTransfer.setData("text/plain", String(meta.id));
  event.dataTransfer.setData(MIME, JSON.stringify(meta));
  event.dataTransfer.effectAllowed = "move";
}

export function readGroupingDragData(event: DragEvent): GroupingDragMeta | null {
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

  const id = Number(event.dataTransfer.getData("text/plain"));
  if (!Number.isFinite(id)) return null;
  return { entity: "student", id, source: "unassigned" };
}
