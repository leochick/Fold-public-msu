"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import RowActions from "../RowActions";
import { deleteStudentAction } from "./actions";

export type StudentListRow = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  year: string | null;
  engagement: string | null;
  igHandle: string | null;
  primaryContact: string | null;
  email: string | null;
  phone: string | null;
};

function studentMatchesQuery(student: StudentListRow, query: string): boolean {
  const haystack = [
    student.firstName,
    student.lastName ?? "",
    `${student.firstName} ${student.lastName ?? ""}`.trim(),
    student.igHandle ?? "",
    student.email ?? "",
    student.phone ?? "",
    student.primaryContact ?? "",
    student.engagement ?? "",
    student.year ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function StudentsAllList({ students }: { students: StudentListRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      normalizedQuery
        ? students.filter((student) => studentMatchesQuery(student, normalizedQuery))
        : students,
    [students, normalizedQuery]
  );

  const countLabel =
    normalizedQuery && students.length > 0
      ? `${filtered.length} of ${students.length}`
      : `${students.length} total`;

  return (
    <>
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or IG…"
          className="input flex-1"
          aria-label="Search students"
        />
        {students.length > 0 && (
          <span className="text-sm text-black/60 whitespace-nowrap shrink-0">{countLabel}</span>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Year</th>
              <th>Engagement</th>
              <th>IG</th>
              <th>Contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-black/50 py-8">
                  No students yet. Use Quick Add above or <Link className="underline" href="/students/new">add one manually</Link>.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-black/50 py-8">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td>
                    <Link href={`/students/${s.id}`} className="font-medium hover:underline">
                      {s.firstName} {s.lastName ?? ""}
                    </Link>
                    <div className="text-xs text-black/50">
                      {s.gender ? (s.gender === "M" ? "♂" : "♀") : ""}
                    </div>
                  </td>
                  <td>{s.year ?? <span className="text-black/30">—</span>}</td>
                  <td>
                    {s.engagement ? (
                      <span className="chip">{s.engagement}</span>
                    ) : (
                      <span className="text-black/30">—</span>
                    )}
                  </td>
                  <td>
                    {s.igHandle ? (
                      <span className="text-black/70">@{s.igHandle}</span>
                    ) : (
                      <span className="text-black/30">—</span>
                    )}
                  </td>
                  <td className="text-sm">{s.primaryContact ?? <span className="text-black/30">—</span>}</td>
                  <td className="text-right">
                    <RowActions
                      id={s.id}
                      deleteAction={deleteStudentAction}
                      confirmMessage={`Delete ${s.firstName} ${s.lastName ?? ""}? This also removes their attendance history. This can't be undone.`}
                    />
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
