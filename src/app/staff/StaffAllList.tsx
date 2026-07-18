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

function StaffRows({ rows }: { rows: StaffListRow[] }) {
  return (
    <>
      {rows.map((s) => (
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
      ))}
    </>
  );
}

export default function StaffAllList({
  activeStaff,
  inactiveStaff,
}: {
  activeStaff: StaffListRow[];
  inactiveStaff: StaffListRow[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const total = activeStaff.length + inactiveStaff.length;

  const filteredActive = useMemo(
    () =>
      normalizedQuery
        ? activeStaff.filter((member) => staffMatchesQuery(member, normalizedQuery))
        : activeStaff,
    [activeStaff, normalizedQuery]
  );
  const filteredInactive = useMemo(
    () =>
      normalizedQuery
        ? inactiveStaff.filter((member) => staffMatchesQuery(member, normalizedQuery))
        : inactiveStaff,
    [inactiveStaff, normalizedQuery]
  );

  const filteredTotal = filteredActive.length + filteredInactive.length;
  const countLabel =
    normalizedQuery && total > 0 ? `${filteredTotal} of ${total}` : `${total} total`;

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
        {total > 0 && (
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
            {total === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-black/50 py-8">
                  No staff yet. <Link className="underline" href="/staff/new">Add one</Link>.
                </td>
              </tr>
            ) : filteredTotal === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-black/50 py-8">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </td>
              </tr>
            ) : (
              <>
                {filteredActive.length > 0 && (
                  <>
                    <tr>
                      <td
                        colSpan={2}
                        className="bg-black/[0.04] dark:bg-white/[0.06] text-xs font-semibold uppercase tracking-wide text-black/60 dark:text-white/60 pt-3 pb-2"
                      >
                        Active (within current view)
                      </td>
                    </tr>
                    <StaffRows rows={filteredActive} />
                  </>
                )}
                {filteredInactive.length > 0 && (
                  <>
                    <tr>
                      <td
                        colSpan={2}
                        className="bg-black/[0.04] dark:bg-white/[0.06] text-xs font-semibold uppercase tracking-wide text-black/60 dark:text-white/60 pt-3 pb-2"
                      >
                        Inactive (outside of current view)
                      </td>
                    </tr>
                    <StaffRows rows={filteredInactive} />
                  </>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
