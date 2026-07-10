"use client";

import Link from "next/link";
import { readGroupingDragData, setGroupingDragData, type GroupingDragMeta } from "@/lib/grouping-drag";

export type StaffCardData = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
};

export default function StaffDragCard({
  staff,
  dragMeta,
  onDragStart,
  onDragEnd,
  onDropOnCard,
  onDragEnterCard,
}: {
  staff: StaffCardData;
  dragMeta: GroupingDragMeta;
  onDragStart: (staffId: number) => void;
  onDragEnd?: () => void;
  onDropOnCard?: (event: React.DragEvent<HTMLDivElement>) => void;
  /** Called with true when pointer is in the top half (insert before), false for bottom half (insert after). */
  onDragEnterCard?: (insertBefore: boolean) => void;
}) {
  const nameClass =
    staff.gender === "M"
      ? "text-blue-700 dark:text-blue-300"
      : staff.gender === "F"
        ? "text-red-700 dark:text-red-300"
        : "text-black dark:text-white";
  const fullName = `${staff.firstName} ${staff.lastName ?? ""}`.trim();

  return (
    <div
      draggable
      onDragStart={(event) => {
        setGroupingDragData(event, dragMeta);
        onDragStart(staff.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragEnter={(event) => {
        if (!onDragEnterCard) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onDragEnterCard(event.clientY < rect.top + rect.height / 2);
      }}
      onDragOver={(event) => {
        if (!onDragEnterCard) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        onDragEnterCard(event.clientY < rect.top + rect.height / 2);
      }}
      onDrop={(event) => {
        if (!onDropOnCard) return;
        const meta = readGroupingDragData(event);
        if (!meta || meta.entity !== "staff" || meta.id === staff.id) return;
        event.preventDefault();
        event.stopPropagation();
        onDropOnCard(event);
      }}
      className="rounded-lg border p-2 cursor-grab active:cursor-grabbing shadow-sm bg-black/[0.03] dark:bg-white/[0.04]"
    >
      <Link
        href={`/staff/${staff.id}`}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        className={`text-sm font-medium hover:underline ${nameClass}`}
      >
        {fullName}
      </Link>
    </div>
  );
}
