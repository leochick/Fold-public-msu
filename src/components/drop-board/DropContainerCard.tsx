"use client";

import { Fragment, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  isGroupingContainerDrag,
  setGroupingContainerDragData,
} from "@/lib/grouping-drag";
import { isDragLeave } from "@/lib/drag-leave";
import InsertionGap from "./InsertionGap";

export type DropItemApi = {
  beginItemDrag: () => void;
  hoverItem: (insertBefore: boolean) => void;
};

export default function DropContainerCard<T>({
  title,
  containerIndex,
  items,
  itemKey,
  renderItem,
  isItemVisible = () => true,
  activeDrag,
  emptyLabel,
  headerExtra,
  footer,
  isDragOver,
  onTitleChange,
  onRequestDelete,
  onDragEnter,
  onDragLeave,
  onDropItem,
  isContainerDragging,
  isContainerReorderActive,
  onContainerReorderDragStart,
  onContainerReorderDragOver,
  onContainerReorderDrop,
  onContainerReorderDragEnd,
}: {
  title: string;
  containerIndex: number;
  items: T[];
  itemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number, api: DropItemApi) => ReactNode;
  isItemVisible?: (item: T) => boolean;
  activeDrag: boolean;
  emptyLabel: string;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  isDragOver: boolean;
  onTitleChange: (title: string) => void;
  onRequestDelete: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  /** Return true when the drop was accepted so the highlight can clear. */
  onDropItem: (event: DragEvent<HTMLDivElement>, insertAt: number) => boolean;
  isContainerDragging: boolean;
  /** May read a ref — call inside event handlers so dragover works before re-render. */
  isContainerReorderActive: () => boolean;
  onContainerReorderDragStart: (index: number) => void;
  onContainerReorderDragOver: (index: number, insertBefore: boolean) => void;
  onContainerReorderDrop: () => void;
  onContainerReorderDragEnd: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const insertAtIndexRef = useRef<number | null>(null);

  const hasVisibleItems = items.some(isItemVisible);
  const isEmpty = items.length === 0;
  const reorderLabel = title.trim() || `container ${containerIndex + 1}`;

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

  function handleContainerDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (isContainerReorderActive() || isGroupingContainerDrag(event)) {
      onContainerReorderDrop();
      return;
    }

    const insertAt = insertAtIndexRef.current ?? items.length;
    const accepted = onDropItem(event, insertAt);
    if (!accepted) return;
    clearInsertion();
    onDragLeave();
  }

  function handleContainerReorderDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isContainerReorderActive() && !isGroupingContainerDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const insertBefore =
      rect.width >= rect.height
        ? event.clientX < rect.left + rect.width / 2
        : event.clientY < rect.top + rect.height / 2;
    onContainerReorderDragOver(containerIndex, insertBefore);
  }

  function handleReorderHandleDragStart(event: DragEvent<HTMLSpanElement>) {
    event.stopPropagation();
    clearInsertion();
    onDragLeave();

    setGroupingContainerDragData(event, { fromIndex: containerIndex });

    const card = cardRef.current;
    if (card) {
      const rect = card.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        card,
        Math.min(24, rect.width / 4),
        Math.min(24, rect.height / 4)
      );
    }

    onContainerReorderDragStart(containerIndex);
  }

  function showGap(index: number) {
    return !isContainerReorderActive() && activeDrag && insertAtIndex === index;
  }

  function handleCardHover(index: number, insertBefore: boolean) {
    if (isContainerReorderActive()) return;
    setInsertion(insertBefore ? index : index + 1);
  }

  const cardClassName = [
    "card min-h-[10rem] w-full self-start isolate transition-opacity duration-150",
    isContainerDragging ? "opacity-40" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
    <div
      ref={cardRef}
      data-container-card
      className={cardClassName}
      onDragOver={handleContainerReorderDragOver}
      onDrop={(event) => {
        if (!isContainerReorderActive() && !isGroupingContainerDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        onContainerReorderDrop();
      }}
    >
      <div className="flex items-center gap-1 mb-3">
        <span
          draggable
          onDragStart={handleReorderHandleDragStart}
          onDragEnd={onContainerReorderDragEnd}
          className="inline-flex cursor-grab active:cursor-grabbing select-none px-1 py-1.5 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          title="Drag to reorder"
          aria-label={`Drag to reorder ${reorderLabel}`}
        >
          ⋮⋮
        </span>
        <input
          type="text"
          className="input flex-1 min-w-0"
          placeholder="Container title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button
          type="button"
          className="btn-ghost shrink-0 px-1 py-0.5 text-[10px] leading-none text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          aria-label={`Delete container ${reorderLabel}`}
          onClick={onRequestDelete}
        >
          ✕
        </button>
      </div>
      {headerExtra}
      <div
        className={`rounded-lg border border-dashed p-2 min-h-[6rem] transition-colors ${
          isDragOver ? "border-accent/50 bg-accent/5" : "border-black/10 dark:border-white/15"
        }`}
        onDragOver={(event) => {
          if (isContainerReorderActive() || isGroupingContainerDrag(event)) {
            handleContainerReorderDragOver(event);
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(event) => {
          if (isContainerReorderActive() || isGroupingContainerDrag(event)) return;
          event.preventDefault();
          onDragEnter();
          if (isEmpty && activeDrag) setInsertion(0);
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
            {emptyLabel}
          </p>
        )}

        {renderGap(0)}
        {items.map((item, index) => {
          if (!isItemVisible(item)) return null;
          const api: DropItemApi = {
            beginItemDrag: clearInsertion,
            hoverItem: (insertBefore) => handleCardHover(index, insertBefore),
          };
          return (
            <Fragment key={itemKey(item, index)}>
              {renderItem(item, index, api)}
              {renderGap(index + 1)}
            </Fragment>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
