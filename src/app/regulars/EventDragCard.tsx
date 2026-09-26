"use client";

import Link from "next/link";
import { setRegularsDragData, type RegularsDragMeta } from "@/lib/regulars-drag";
import type { RegularsEvent } from "@/lib/regulars";

function formatEventDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EventDragCard({
  event,
  dragMeta,
  onDragStart,
  onDragEnd,
  onDragEnterCard,
}: {
  event: RegularsEvent;
  dragMeta: RegularsDragMeta;
  onDragStart: () => void;
  onDragEnd?: () => void;
  /** Called with true when the pointer is in the top half (insert before). */
  onDragEnterCard?: (insertBefore: boolean) => void;
}) {
  const dateLabel = formatEventDate(event.startDate);
  const typeLabel = event.type?.trim() || "No type";

  return (
    <div
      draggable
      onDragStart={(dragEvent) => {
        setRegularsDragData(dragEvent, dragMeta);
        onDragStart();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragEnter={(dragEvent) => {
        if (!onDragEnterCard) return;
        dragEvent.preventDefault();
        const rect = dragEvent.currentTarget.getBoundingClientRect();
        onDragEnterCard(dragEvent.clientY < rect.top + rect.height / 2);
      }}
      onDragOver={(dragEvent) => {
        if (!onDragEnterCard) return;
        dragEvent.preventDefault();
        dragEvent.dataTransfer.dropEffect = "move";
        const rect = dragEvent.currentTarget.getBoundingClientRect();
        onDragEnterCard(dragEvent.clientY < rect.top + rect.height / 2);
      }}
      className="rounded-lg border p-2 cursor-grab active:cursor-grabbing shadow-sm bg-white dark:bg-white/5 border-black/5 dark:border-white/10"
    >
      <Link
        href={`/events/${event.id}`}
        draggable={false}
        onDragStart={(dragEvent) => dragEvent.preventDefault()}
        className="text-sm font-medium hover:underline"
      >
        {event.name}
      </Link>
      <p className="mt-1 text-xs text-black/60 dark:text-white/60">
        {typeLabel}
        {dateLabel ? ` · ${dateLabel}` : ""}
      </p>
    </div>
  );
}
