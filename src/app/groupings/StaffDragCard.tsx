"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  associatedRoleName,
  onAssociateWithRole,
}: {
  staff: StaffCardData;
  dragMeta: GroupingDragMeta;
  onDragStart: (staffId: number) => void;
  onDragEnd?: () => void;
  onDropOnCard?: (event: React.DragEvent<HTMLDivElement>) => void;
  /** Called with true when pointer is in the top half (insert before), false for bottom half (insert after). */
  onDragEnterCard?: (insertBefore: boolean) => void;
  /** Role associated with this staff placement in a container. */
  associatedRoleName?: string;
  /** When set, shows a ⋮ menu with "Associate with role". */
  onAssociateWithRole?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const nameClass =
    staff.gender === "M"
      ? "text-blue-700 dark:text-blue-300"
      : staff.gender === "F"
        ? "text-red-700 dark:text-red-300"
        : "text-black dark:text-white";
  const fullName = `${staff.firstName} ${staff.lastName ?? ""}`.trim();
  const showActions = Boolean(onAssociateWithRole);

  function toggleMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen((open) => !open);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function close() {
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={(event) => {
        setMenuOpen(false);
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
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <Link
            href={`/staff/${staff.id}`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            className={`text-sm font-medium hover:underline ${nameClass}`}
          >
            {fullName}
          </Link>
          {associatedRoleName ? (
            <p className="mt-1 text-xs italic text-black/60 dark:text-white/60">
              {associatedRoleName}
            </p>
          ) : null}
        </div>
        {showActions && (
          <button
            ref={btnRef}
            type="button"
            draggable={false}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={toggleMenu}
            aria-label={`Actions for ${fullName}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="btn-ghost shrink-0 px-1.5 py-0.5 leading-none text-black/45 dark:text-white/45 hover:text-black/70 dark:hover:text-white/70"
          >
            ⋮
          </button>
        )}
      </div>
      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 50 }}
          className="min-w-40 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen(false);
              onAssociateWithRole?.();
            }}
          >
            Associate with role
          </button>
        </div>
      )}
    </div>
  );
}
