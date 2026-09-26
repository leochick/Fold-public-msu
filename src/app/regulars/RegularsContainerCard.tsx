"use client";

import type { DragEvent } from "react";
import DropContainerCard from "@/components/drop-board/DropContainerCard";
import { readRegularsDragData } from "@/lib/regulars-drag";
import type { RegularsContainer, RegularsEvent } from "@/lib/regulars";
import EventDragCard from "./EventDragCard";

export default function RegularsContainerCard({
  container,
  containerIndex,
  eventsById,
  activeDrag,
  onTitleChange,
  onInsertEventAt,
  onDragStart,
  onDragEnd,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onRequestDelete,
  isContainerDragging,
  isContainerReorderActive,
  onContainerReorderDragStart,
  onContainerReorderDragOver,
  onContainerReorderDrop,
  onContainerReorderDragEnd,
}: {
  container: RegularsContainer;
  containerIndex: number;
  eventsById: Map<number, RegularsEvent>;
  activeDrag: boolean;
  onTitleChange: (index: number, title: string) => void;
  onInsertEventAt: (containerIndex: number, eventId: number, insertAt: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onRequestDelete: (index: number) => void;
  isContainerDragging: boolean;
  isContainerReorderActive: () => boolean;
  onContainerReorderDragStart: (index: number) => void;
  onContainerReorderDragOver: (index: number, insertBefore: boolean) => void;
  onContainerReorderDrop: () => void;
  onContainerReorderDragEnd: () => void;
}) {
  const eventCount = container.eventIds.length;

  function handleDropItem(event: DragEvent<HTMLDivElement>, insertAt: number) {
    const meta = readRegularsDragData(event);
    if (!meta) return false;
    onDragEnd();
    onInsertEventAt(containerIndex, meta.id, insertAt);
    return true;
  }

  return (
    <DropContainerCard
      title={container.title}
      containerIndex={containerIndex}
      items={container.eventIds}
      itemKey={(eventId) => String(eventId)}
      activeDrag={activeDrag}
      emptyLabel="Drop events here"
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
      footer={
        <p className="mt-2 text-xs text-black/50 dark:text-white/50 text-center">
          {eventCount} {eventCount === 1 ? "event" : "events"}
        </p>
      }
      renderItem={(eventId, _index, api) => {
        const event = eventsById.get(eventId);
        if (!event) return null;
        return (
          <div className="relative z-10">
            <EventDragCard
              event={event}
              dragMeta={{ id: event.id, source: "container", containerIndex }}
              onDragStart={() => {
                api.beginItemDrag();
                onDragStart();
                onDragEnter();
              }}
              onDragEnd={onDragEnd}
              onDragEnterCard={(insertBefore) => api.hoverItem(insertBefore)}
            />
          </div>
        );
      }}
    />
  );
}
