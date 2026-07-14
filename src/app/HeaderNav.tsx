"use client";

import Link from "next/link";
import { useState } from "react";
import ViewsMenu from "./ViewsMenu";
import type { DashboardViewItem } from "@/server/dashboard-views";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/students", label: "Students" },
  { href: "/staff", label: "Staff" },
  { href: "/groupings", label: "Groupings" },
  { href: "/changelog", label: "Changelog" },
  { href: "/help", label: "Help" },
];

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
      <nav className="hidden md:flex gap-4 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:underline">{l.label}</Link>
        ))}
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
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="py-1 hover:underline"
              >
                {l.label}
              </Link>
            ))}
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
