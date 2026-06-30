"use client";

import type { BatchRosterIncoming } from "@/lib/contracts/students";
import { getIncomingFieldChanges, hasIncomingUpdates } from "@/lib/batch-roster-changes";

export type { BatchRosterIncoming };

export interface BatchRosterItem {
  incoming: BatchRosterIncoming;
  isDuplicate: boolean;
  existingRecords: any[];
  chosenAction: "create" | "merge" | "skip";
  selectedExistingId?: number;
}

interface Props {
  items: BatchRosterItem[];
  explanation?: string;
  onActionToggle: (index: number, action: "create" | "merge" | "skip") => void;
  onTargetIdChange: (index: number, existingId: number) => void;
  mergeButtonLabel?: string;
}

function FieldChangesPanel({
  changes,
  variant,
}: {
  changes: ReturnType<typeof getIncomingFieldChanges>;
  variant: "merge" | "create";
}) {
  if (!changes.length) return null;

  return (
    <div
      className={`p-3 border rounded-lg text-xs space-y-2 ${
        variant === "merge"
          ? "bg-amber-500/5 border-amber-500/20"
          : "bg-emerald-500/5 border-emerald-500/20"
      }`}
    >
      <div
        className={`font-semibold uppercase tracking-wider text-[10px] ${
          variant === "merge" ? "text-amber-700" : "text-emerald-700"
        }`}
      >
        {variant === "merge" ? "Fields to merge" : "Fields to apply"}
      </div>
      <div className="space-y-2">
        {changes.map((change) => (
          <div key={change.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium text-black/70">{change.label}:</span>
            {change.before != null && change.before !== change.after ? (
              <>
                <span className="text-black/40 line-through">{change.before}</span>
                <span className="text-black/30">→</span>
                <span className="font-semibold text-accent">{change.after}</span>
              </>
            ) : (
              <span className="font-semibold text-accent">{change.after}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BatchRosterReviewList({
  items,
  explanation,
  onActionToggle,
  onTargetIdChange,
  mergeButtonLabel = "Merge",
}: Props) {
  return (
    <div className="space-y-4">
      {explanation && <p className="text-xs text-black/50 italic">{explanation}</p>}

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {items.map((item, i) => {
          const selectedRecord =
            item.existingRecords.find((r) => r.id === item.selectedExistingId) ||
            item.existingRecords[0];
          const fieldChanges = getIncomingFieldChanges(
            item.incoming,
            item.chosenAction === "merge" ? selectedRecord : null
          );
          const hasUpdates = hasIncomingUpdates(item.incoming);

          return (
            <div key={i} className="p-3 border rounded-xl bg-black/5 dark:bg-white/5 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-base">
                    {item.incoming.firstName} {item.incoming.lastName ?? ""}
                  </span>
                  <span className="ml-2 text-xs text-black/40">Parsed Data Entry</span>
                </div>

                <div className="flex gap-1">
                  {item.isDuplicate && (
                    <button
                      onClick={() => onActionToggle(i, "merge")}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                        item.chosenAction === "merge" ? "bg-amber-600 text-white" : "bg-black/5 hover:bg-black/10"
                      }`}
                    >
                      {mergeButtonLabel}
                    </button>
                  )}
                  <button
                    onClick={() => onActionToggle(i, "create")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                      item.chosenAction === "create" ? "bg-accent text-white" : "bg-black/5 hover:bg-black/10"
                    }`}
                  >
                    Create New
                  </button>
                  <button
                    onClick={() => onActionToggle(i, "skip")}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                      item.chosenAction === "skip" ? "bg-red-600 text-white" : "bg-black/5 hover:bg-black/10"
                    }`}
                  >
                    Skip
                  </button>
                </div>
              </div>

              {hasUpdates && item.chosenAction !== "skip" && (
                <FieldChangesPanel
                  changes={fieldChanges}
                  variant={item.isDuplicate && item.chosenAction === "merge" ? "merge" : "create"}
                />
              )}

              {item.isDuplicate && item.existingRecords.length > 0 ? (
                <div className="space-y-2">
                  {item.existingRecords.length > 1 && item.chosenAction === "merge" && (
                    <div className="flex items-center gap-2 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <label className="text-xs font-medium text-amber-800 shrink-0" htmlFor={`match-sel-${i}`}>
                        ⚠️ Multiple options found! Select record:
                      </label>
                      <select
                        id={`match-sel-${i}`}
                        value={item.selectedExistingId}
                        onChange={(e) => onTargetIdChange(i, Number(e.target.value))}
                        className="input text-xs py-1 bg-white dark:bg-zinc-900 border"
                      >
                        {item.existingRecords.map((rec) => (
                          <option key={rec.id} value={rec.id}>
                            {rec.firstName} {rec.lastName ?? ""} ({rec.year || "No year listed"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedRecord && item.chosenAction === "merge" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white dark:bg-zinc-800 border rounded-lg text-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-black/40 uppercase tracking-wider text-[10px]">AI Parsed Fields</div>
                        <div>Year: <span className="font-medium">{item.incoming.year || "—"}</span></div>
                        <div>Gender: <span className="font-medium">{item.incoming.gender || "—"}</span></div>
                        <div>Phone: <span className="font-medium">{item.incoming.phone || "—"}</span></div>
                        <div>Email: <span className="font-medium">{item.incoming.email || "—"}</span></div>
                        <div>Instagram: <span className="font-medium">{item.incoming.igHandle ? `@${item.incoming.igHandle}` : "—"}</span></div>
                      </div>
                      <div className="space-y-1 border-l pl-4 border-black/10">
                        <div className="font-semibold text-amber-600 uppercase tracking-wider text-[10px]">Target Record Match</div>
                        <div>Name: <span className="font-medium">{selectedRecord.firstName} {selectedRecord.lastName ?? ""}</span></div>
                        <div>Year: <span className="font-medium">{selectedRecord.year || "—"}</span></div>
                        <div>Phone: <span className="font-medium">{selectedRecord.phone || "—"}</span></div>
                        <div>Email: <span className="font-medium">{selectedRecord.email || "—"}</span></div>
                        <div>Instagram: <span className="font-medium">{selectedRecord.igHandle ? `@${selectedRecord.igHandle}` : "—"}</span></div>
                        {Array.isArray(selectedRecord.courseMaterial) && selectedRecord.courseMaterial.length > 0 && (
                          <div>Courses: <span className="font-medium">{selectedRecord.courseMaterial.join(", ")}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                !hasUpdates && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-700 text-xs rounded-lg font-medium">
                    ✓ Unmatched Entry: Clean profile record.
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
