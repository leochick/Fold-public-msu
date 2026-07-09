"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type StaffListRow = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: string | null;
};

function staffMatchesQuery(member: StaffListRow, query: string): boolean {
  const haystack = [
    member.firstName,
    member.lastName ?? "",
    `${member.firstName} ${member.lastName ?? ""}`.trim(),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function StaffAllList({ staff }: { staff: StaffListRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      normalizedQuery
        ? staff.filter((member) => staffMatchesQuery(member, normalizedQuery))
        : staff,
    [staff, normalizedQuery]
  );

  const countLabel =
    normalizedQuery && staff.length > 0
      ? `${filtered.length} of ${staff.length}`
      : `${staff.length} total`;

  return (
    <>
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name…"
          className="input flex-1"
          aria-label="Search staff"
        />
        {staff.length > 0 && (
          <span className="text-sm text-black/60 whitespace-nowrap shrink-0">{countLabel}</span>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Gender</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-black/50 py-8">
                  No staff yet. <Link className="underline" href="/staff/new">Add one</Link>.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-black/50 py-8">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td>
                    <Link href={`/staff/${s.id}`} className="font-medium hover:underline">
                      {s.firstName} {s.lastName ?? ""}
                    </Link>
                  </td>
                  <td>
                    {s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : <span className="text-black/30">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
