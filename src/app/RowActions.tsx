"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  id: number;
  deleteAction: (formData: FormData) => Promise<void>;
  confirmMessage: string;
};

export default function RowActions({ id, deleteAction, confirmMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function close() {
      setOpen(false);
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
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-ghost px-2 py-1 leading-none"
      >
        ⋯
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 50 }}
          className="card min-w-32 p-1 shadow-lg"
        >
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(confirmMessage)) {
                e.preventDefault();
              } else {
                setOpen(false);
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded px-3 py-1.5 text-left text-sm text-red-600 hover:bg-black/5 dark:hover:bg-white/5"
            >
              Delete
            </button>
          </form>
        </div>
      )}
    </>
  );
}
