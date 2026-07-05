"use client";

import Link from "next/link";
import { useState } from "react";
import { formatChangelogSummaryForDisplay } from "@/lib/changelog";
import type { ChangelogEntryRow } from "@/server/changelog";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function entityHref(entry: ChangelogEntryRow) {
  if (!entry.entityId) return null;
  if (entry.entityType === "student" && entry.action !== "delete") {
    return `/students/${entry.entityId}`;
  }
  if (entry.entityType === "event" && entry.action !== "delete") {
    return `/events/${entry.entityId}`;
  }
  return null;
}

export default function ChangelogTable({
  initialEntries,
  initialHasMore,
  initialNextOffset,
}: {
  initialEntries: ChangelogEntryRow[];
  initialHasMore: boolean;
  initialNextOffset: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/changelog?offset=${nextOffset}&limit=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load more");
      setEntries((current) => [...current, ...data.entries]);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="whitespace-nowrap">When</th>
              <th className="whitespace-nowrap">User</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-black/50 py-8">
                  No changes recorded yet.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const href = entityHref(entry);
                const summary = formatChangelogSummaryForDisplay(entry.summary, entry.action);
                return (
                  <tr key={entry.id} className="hover:bg-black/5 dark:hover:bg-white/5 align-top">
                    <td className="text-sm text-black/70 whitespace-nowrap">
                      {formatTimestamp(entry.createdAt)}
                    </td>
                    <td className="text-sm whitespace-nowrap">
                      {entry.userName ?? <span className="text-black/40">Unknown</span>}
                    </td>
                    <td className="text-sm">
                      <div className="font-medium">
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {entry.entityLabel}
                          </Link>
                        ) : (
                          entry.entityLabel
                        )}
                        <span className="ml-2 chip text-xs capitalize">{entry.action}</span>
                      </div>
                      {summary ? (
                        <div className="text-black/70 mt-1 whitespace-pre-line">{summary}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn-ghost border border-black/10 dark:border-white/10"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
