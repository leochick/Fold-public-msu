"use client";

import { useState, useTransition } from "react";
import type { GroupingContainerData } from "../../../drizzle/schema";
import { saveGroupingVersionAction } from "../groupings-actions";
import type { GroupingVersionItem } from "@/server/groupings";

export default function GroupingVersionsCard({
  groupingId,
  versions,
  activeVersionId,
  getSnapshot,
  onVersionsChange,
  onSelectVersion,
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
}) {
  const [versionName, setVersionName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
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

  return (
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
              <button
                key={version.id}
                type="button"
                className={`btn text-xs px-3 py-1.5 ${
                  isActive ? "btn-primary" : "btn-ghost border border-black/10 dark:border-white/15"
                }`}
                onClick={() => onSelectVersion(version)}
                aria-pressed={isActive}
              >
                {version.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-black/50 dark:text-white/50 mt-3">
          Save named snapshots of this grouping to compare arrangements side by side.
        </p>
      )}
    </div>
  );
}
