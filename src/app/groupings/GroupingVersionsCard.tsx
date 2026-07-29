"use client";

import { useState, useTransition } from "react";
import type { GroupingContainerData } from "../../../drizzle/schema";
import {
  deleteGroupingVersionAction,
  saveGroupingVersionAction,
  setDefaultGroupingVersionAction,
} from "../groupings-actions";
import { pickInitialGroupingVersion } from "@/lib/grouping-versions";
import type { GroupingVersionItem } from "@/server/groupings";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinejoin="round"
        d="M10 2.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9L10 13.77l-4.4 2.28.84-4.9L2.88 7.68l4.92-.72L10 2.5z"
      />
    </svg>
  );
}

export default function GroupingVersionsCard({
  groupingId,
  versions,
  activeVersionId,
  getSnapshot,
  onVersionsChange,
  onSelectVersion,
  onClearActiveVersion,
}: {
  groupingId: number;
  versions: GroupingVersionItem[];
  activeVersionId: number | null;
  getSnapshot: () => {
    checkedEventIds: number[] | null;
    includeNewsletterContacts: boolean;
    containers: GroupingContainerData[];
  };
  onVersionsChange: (versions: GroupingVersionItem[]) => void;
  onSelectVersion: (version: GroupingVersionItem) => void;
  onClearActiveVersion: () => void;
}) {
  const [versionName, setVersionName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupingVersionItem | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveVersion() {
    const trimmed = versionName.trim();
    if (!trimmed) return;
    setSaveError(null);
    const snapshot = getSnapshot();
    startTransition(async () => {
      try {
        const created = await saveGroupingVersionAction(
          groupingId,
          trimmed,
          snapshot.checkedEventIds,
          snapshot.containers,
          snapshot.includeNewsletterContacts
        );
        onVersionsChange([...versions, created]);
        onSelectVersion(created);
        setVersionName("");
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save version");
      }
    });
  }

  function setDefaultVersion(version: GroupingVersionItem) {
    if (version.isDefault) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        await setDefaultGroupingVersionAction(version.id);
        onVersionsChange(
          versions.map((entry) => ({
            ...entry,
            isDefault: entry.id === version.id,
          }))
        );
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not set default version");
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      try {
        await deleteGroupingVersionAction(target.id);
        const remaining = versions.filter((version) => version.id !== target.id);
        onVersionsChange(remaining);
        if (activeVersionId === target.id) {
          const next = pickInitialGroupingVersion(remaining);
          if (next) {
            onSelectVersion(next);
          } else {
            onClearActiveVersion();
          }
        }
        setDeleteTarget(null);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not delete version");
        setDeleteTarget(null);
      }
    });
  }

  return (
    <>
      <div className="card">
        <h2 className="text-sm font-semibold mb-3">Versions</h2>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="grouping-version-name" className="label block mb-1">
              Version name
            </label>
            <input
              id="grouping-version-name"
              type="text"
              className="input"
              placeholder="e.g. Draft A"
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveVersion();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveVersion}
            disabled={!versionName.trim() || isPending}
          >
            {isPending ? "Saving…" : "Save as version"}
          </button>
        </div>
        {saveError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{saveError}</p>}
        {versions.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-3">
            {versions.map((version) => {
              const isActive = version.id === activeVersionId;
              return (
                <div
                  key={version.id}
                  className={`inline-flex items-stretch overflow-hidden rounded-lg border text-xs font-medium ${
                    isActive
                      ? "border-accent/40 bg-accent/10 text-ink dark:text-paper"
                      : "border-black/10 dark:border-white/15 bg-transparent"
                  }`}
                >
                  <button
                    type="button"
                    className="px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => onSelectVersion(version)}
                    aria-pressed={isActive}
                  >
                    {version.name}
                  </button>
                  <button
                    type="button"
                    className={`px-2 border-l border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 ${
                      version.isDefault
                        ? "text-amber-500"
                        : "text-black/35 dark:text-white/35 hover:text-amber-500"
                    }`}
                    aria-label={
                      version.isDefault
                        ? `${version.name} is the default version`
                        : `Set ${version.name} as default version`
                    }
                    aria-pressed={version.isDefault}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDefaultVersion(version);
                    }}
                    disabled={isPending || version.isDefault}
                  >
                    <StarIcon filled={version.isDefault} />
                  </button>
                  <button
                    type="button"
                    className="px-2 border-l border-black/10 dark:border-white/15 text-black/45 dark:text-white/45 hover:bg-black/5 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Delete version ${version.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSaveError(null);
                      setDeleteTarget(version);
                    }}
                    disabled={isPending}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-black/50 dark:text-white/50 mt-3">
            Save named snapshots of this grouping to compare arrangements side by side.
            Star a version to use it on load and in Staff Allocation.
          </p>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Delete version</h2>
            <p className="text-sm text-black/60 dark:text-white/60 mt-2">
              Delete <span className="font-medium text-black dark:text-white">{deleteTarget.name}</span>?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary bg-red-600 hover:opacity-90 text-white border-red-600"
                onClick={confirmDelete}
                disabled={isPending}
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
