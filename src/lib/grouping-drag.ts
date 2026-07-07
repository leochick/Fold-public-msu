import type { DragEvent } from "react";

export type GroupingDragSource = "unassigned" | "container";

export type GroupingDragMeta = {
  studentId: number;
  source: GroupingDragSource;
  containerIndex?: number;
};

const MIME = "application/x-grouping-drag";

export function setGroupingDragData(event: DragEvent, meta: GroupingDragMeta) {
  event.dataTransfer.setData("text/plain", String(meta.studentId));
  event.dataTransfer.setData(MIME, JSON.stringify(meta));
  event.dataTransfer.effectAllowed = "move";
}

export function readGroupingDragData(event: DragEvent): GroupingDragMeta | null {
  const raw = event.dataTransfer.getData(MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GroupingDragMeta;
      if (Number.isFinite(parsed.studentId)) return parsed;
    } catch {
      // fall through
    }
  }

  const studentId = Number(event.dataTransfer.getData("text/plain"));
  if (!Number.isFinite(studentId)) return null;
  return { studentId, source: "unassigned" };
}
