"use client";

import type { BatchEventIncoming } from "@/lib/contracts/events";
import { getIncomingEventFieldChanges, hasIncomingEventUpdates } from "@/lib/batch-event-changes";
import { eventDateStr } from "@/lib/funnel/event-dedup";

export type { BatchEventIncoming };

export interface BatchEventItem {
  incoming: BatchEventIncoming;
  isDuplicate: boolean;
  existingRecords: Array<{
    id: number;
    name: string;
    type?: string | null;
    location?: string | null;
    notes?: string | null;
    totalStudents?: number | null;
    startDate: Date | string | number;
  }>;
  chosenAction: "create" | "merge" | "skip";
  selectedExistingId?: number;
}

interface Props {
  items: BatchEventItem[];
  explanation?: string;
  intent?: "create" | "update";
  onActionToggle: (index: number, action: "create" | "merge" | "skip") => void;
  onTargetIdChange: (index: number, existingId: number) => void;
  onIncomingChange?: (index: number, incoming: BatchEventIncoming) => void;
  mergeButtonLabel?: string;
}

function FieldChangesPanel({
  changes,
  variant,
}: {
  changes: ReturnType<typeof getIncomingEventFieldChanges>;
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

export default function BatchEventsReviewList({
  items,
  explanation,
  intent,
  onActionToggle,
  onTargetIdChange,
  onIncomingChange,
  mergeButtonLabel = "Merge",
}: Props) {
  return (
    <div className="space-y-4">
      {explanation && <p className="text-xs text-black/50 italic">{explanation}</p>}
      {intent === "update" && (
        <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Bulk update mode — matched events will be merged. Unmatched events default to skip.
          Notes append with a date stamp (they do not overwrite existing notes).
        </p>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {items.map((item, i) => {
          const selectedRecord =
            item.existingRecords.find((r) => r.id === item.selectedExistingId) ||
            item.existingRecords[0];
          const fieldChanges = getIncomingEventFieldChanges(
            item.incoming,
            item.chosenAction === "merge" ? selectedRecord : null
          );
          const hasUpdates = hasIncomingEventUpdates(item.incoming);

          return (
            <div key={i} className="p-3 border rounded-xl bg-black/5 dark:bg-white/5 space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-base">{item.incoming.name}</span>
                  <span className="ml-2 text-xs text-black/40">{item.incoming.date ?? "no date"}</span>
                </div>

                <div className="flex gap-1">
                  {item.isDuplicate && (
                    <button
                      type="button"
                      onClick={() => onActionToggle(i, "merge")}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                        item.chosenAction === "merge" ? "bg-amber-600 text-white" : "bg-black/5 hover:bg-black/10"
                      }`}
                    >
                      {mergeButtonLabel}
                    </button>
                  )}
                  {intent !== "update" && (
                    <button
                      type="button"
                      onClick={() => onActionToggle(i, "create")}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                        item.chosenAction === "create" ? "bg-accent text-white" : "bg-black/5 hover:bg-black/10"
                      }`}
                    >
                      Create New
                    </button>
                  )}
                  <button
                    type="button"
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

              {onIncomingChange && item.chosenAction !== "skip" && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    className="input md:col-span-2 text-xs"
                    placeholder="Name"
                    value={item.incoming.name}
                    onChange={(e) =>
                      onIncomingChange(i, { ...item.incoming, name: e.target.value })
                    }
                  />
                  <input
                    className="input text-xs"
                    type="date"
                    value={item.incoming.date ?? ""}
                    onChange={(e) =>
                      onIncomingChange(i, { ...item.incoming, date: e.target.value || undefined })
                    }
                  />
                  <input
                    className="input text-xs"
                    placeholder="Type"
                    value={item.incoming.type ?? ""}
                    onChange={(e) =>
                      onIncomingChange(i, { ...item.incoming, type: e.target.value || undefined })
                    }
                  />
                  <input
                    className="input md:col-span-4 text-xs"
                    placeholder="Location"
                    value={item.incoming.location ?? ""}
                    onChange={(e) =>
                      onIncomingChange(i, { ...item.incoming, location: e.target.value || undefined })
                    }
                  />
                  <textarea
                    className="input md:col-span-4 text-xs min-h-[4.5rem]"
                    placeholder="Notes to append"
                    value={item.incoming.notes ?? ""}
                    onChange={(e) =>
                      onIncomingChange(i, { ...item.incoming, notes: e.target.value || undefined })
                    }
                  />
                </div>
              )}

              {item.isDuplicate && item.existingRecords.length > 0 ? (
                <div className="space-y-2">
                  {item.existingRecords.length > 1 && item.chosenAction === "merge" && (
                    <div className="flex items-center gap-2 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <label className="text-xs font-medium text-amber-800 shrink-0" htmlFor={`event-match-${i}`}>
                        Multiple matches — select event:
                      </label>
                      <select
                        id={`event-match-${i}`}
                        value={item.selectedExistingId}
                        onChange={(e) => onTargetIdChange(i, Number(e.target.value))}
                        className="input text-xs py-1 bg-white dark:bg-zinc-900 border"
                      >
                        {item.existingRecords.map((rec) => (
                          <option key={rec.id} value={rec.id}>
                            {rec.name} ({eventDateStr(rec)}) — {rec.type || "no type"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedRecord && item.chosenAction === "merge" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white dark:bg-zinc-800 border rounded-lg text-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-black/40 uppercase tracking-wider text-[10px]">
                          Parsed changes
                        </div>
                        <div>Type: <span className="font-medium">{item.incoming.type || "—"}</span></div>
                        <div>Location: <span className="font-medium">{item.incoming.location || "—"}</span></div>
                        <div>Notes: <span className="font-medium">{item.incoming.notes || "—"}</span></div>
                      </div>
                      <div className="space-y-1 border-l pl-4 border-black/10">
                        <div className="font-semibold text-amber-600 uppercase tracking-wider text-[10px]">
                          Target event
                        </div>
                        <div>Name: <span className="font-medium">{selectedRecord.name}</span></div>
                        <div>Date: <span className="font-medium">{eventDateStr(selectedRecord)}</span></div>
                        <div>Type: <span className="font-medium">{selectedRecord.type || "—"}</span></div>
                        <div>Location: <span className="font-medium">{selectedRecord.location || "—"}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                !hasUpdates &&
                item.chosenAction === "create" && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-700 text-xs rounded-lg font-medium">
                    ✓ No matching event on this date — safe to create.
                  </div>
                )
              )}

              {!item.isDuplicate && intent === "update" && item.chosenAction === "skip" && (
                <div className="p-2 bg-red-500/10 text-red-700 text-xs rounded-lg font-medium">
                  No matching event found{item.incoming.date ? ` on ${item.incoming.date}` : ""} — skipped.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
