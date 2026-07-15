"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import ViewsMenu from "./ViewsMenu";
import type { DashboardViewItem } from "@/server/dashboard-views";

type NavLink = { href: string; label: string };
type NavDropdown = { label: string; items: NavLink[] };
type NavItem = NavLink | NavDropdown;

function isDropdown(item: NavItem): item is NavDropdown {
  return "items" in item;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard" },
  {
    label: "Events, Students, and Staff",
    items: [
      { href: "/events", label: "Events" },
      { href: "/students", label: "Students" },
      { href: "/staff", label: "Staff" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/groupings", label: "Groupings" },
      { href: "/roles", label: "Roles" },
    ],
  },
  { href: "/staff-allocation", label: "Staff Allocation" },
  { href: "/changelog", label: "Changelog" },
  { href: "/help", label: "Help" },
];

function NavDropdownMenu({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavLink[];
  onNavigate?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="hover:underline inline-flex items-center gap-1"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="text-black/40 dark:text-white/40" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 mt-2 min-w-44 z-30 rounded-lg border border-black/10 dark:border-white/10 bg-paper dark:bg-ink shadow-lg p-1"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="block rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNavSection({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavLink[];
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center justify-between py-1 hover:underline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <span className="text-black/40 dark:text-white/40" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="ml-3 mt-1 flex flex-col gap-2 border-l border-black/10 dark:border-white/10 pl-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="py-1 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HeaderNav({
  displayName,
  signOutAction,
  views,
  activeView,
}: {
  displayName: string;
  signOutAction: () => void;
  views: DashboardViewItem[];
  activeView: DashboardViewItem | null;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <nav className="hidden md:flex items-center gap-4 text-sm">
        {navItems.map((item) =>
          isDropdown(item) ? (
            <NavDropdownMenu key={item.label} label={item.label} items={item.items} />
          ) : (
            <Link key={item.href} href={item.href} className="hover:underline">
              {item.label}
            </Link>
          )
        )}
      </nav>
      <div className="ml-auto hidden md:flex items-center gap-3 text-sm">
        <ViewsMenu views={views} activeView={activeView} />
        <span className="text-black/60 dark:text-white/60">{displayName}</span>
        <form action={signOutAction}>
          <button className="btn-ghost" type="submit">Sign out</button>
        </form>
      </div>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="md:hidden ml-auto btn-ghost px-2 text-lg leading-none"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full z-20 border-b border-black/5 dark:border-white/10 bg-paper dark:bg-ink shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 text-sm">
            {navItems.map((item) =>
              isDropdown(item) ? (
                <MobileNavSection
                  key={item.label}
                  label={item.label}
                  items={item.items}
                  onNavigate={close}
                />
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="py-1 hover:underline"
                >
                  {item.label}
                </Link>
              )
            )}
            <div className="border-t border-black/5 dark:border-white/10 pt-3 flex flex-col gap-3">
              <ViewsMenu views={views} activeView={activeView} />
              <div className="flex items-center gap-3">
                <span className="text-black/60 dark:text-white/60">{displayName}</span>
                <form action={signOutAction} className="ml-auto">
                  <button className="btn-ghost" type="submit">Sign out</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
