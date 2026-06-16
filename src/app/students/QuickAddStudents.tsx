"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface RosterItem {
  incoming: {
    firstName: string;
    lastName?: string;
    gender?: "M" | "F";
    year?: string;
    phone?: string;
    email?: string;
    igHandle?: string;
    notes?: string;
    rawText: string;
  };
  isDuplicate: boolean;
  existingRecords: any[]; // Changed from existingRecord to an array
  chosenAction: "create" | "merge" | "skip";
  selectedExistingId?: number; // Tracks precisely WHO we are merging with
}

export default function QuickAddStudents() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [items, setItems] = useState<RosterItem[]>([]);
  const [viewState, setViewState] = useState<"input" | "verify">("input");

  const [isProcessing, startProcessingTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();

  const handleProcessText = async () => {
    if (!text.trim()) return;
    setError("");
    setExplanation("");
    
    startProcessingTransition(async () => {
      try {
        const res = await fetch("/api/students/parse-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Extraction parsing failure.");

        // Automatically configure the initial state
        const initialMappedItems = data.items.map((x: any) => ({
          ...x,
          chosenAction: x.isDuplicate ? "merge" : "create",
          // Default to the highest matching record candidate if duplicates exist
          selectedExistingId: x.isDuplicate ? x.existingRecords[0]?.id : undefined,
        }));

        setItems(initialMappedItems);
        setExplanation(data.explanation);
        setViewState("verify");
      } catch (err: any) {
        setError(err.message || "Network transaction failure.");
      }
    });
  };

  const handleActionToggle = (index: number, action: "create" | "merge" | "skip") => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, chosenAction: action } : item))
    );
  };

  const handleTargetIdChange = (index: number, existingId: number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selectedExistingId: existingId } : item))
    );
  };

  const handleSaveCommit = async () => {
    setError("");
    startSavingTransition(async () => {
      try {
        const res = await fetch("/api/students/commit-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: items.map((x) => ({
              action: x.chosenAction,
              incoming: x.incoming,
              existingId: x.chosenAction === "merge" ? x.selectedExistingId : undefined,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Database save rejection.");

        setText("");
        setItems([]);
        setViewState("input");
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed committing values.");
      }
    });
  };

  return (
    <div className="card space-y-3 border-accent/30">
      <div>
        <h2 className="font-semibold">⚡ AI Quick Add Students Roster</h2>
        <p className="text-xs text-black/60">
          Review, select specific merge targets, or create isolated rows on duplicate collisions.
        </p>
      </div>

      {viewState === "input" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="input font-sans text-sm"
            placeholder={`e.g. "Add Grace"`}
          />
          <button onClick={handleProcessText} disabled={isProcessing || !text.trim()} className="btn-primary">
            {isProcessing ? "Analyzing content..." : "Process Text"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-black/5 dark:border-white/10">
          {explanation && <p className="text-xs text-black/50 italic">{explanation}</p>}

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {items.map((item, i) => {
              // Find the data payload of our currently selected candidate row to preview side-by-side
              const selectedRecord = item.existingRecords.find(r => r.id === item.selectedExistingId) || item.existingRecords[0];

              return (
                <div key={i} className="p-3 border rounded-xl bg-black/5 dark:bg-white/5 space-y-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-base">{item.incoming.firstName} {item.incoming.lastName ?? ""}</span>
                      <span className="ml-2 text-xs text-black/40">Incoming Roster Data</span>
                    </div>

                    <div className="flex gap-1">
                      {item.isDuplicate && (
                        <button
                          onClick={() => handleActionToggle(i, "merge")}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition ${item.chosenAction === "merge" ? "bg-amber-600 text-white" : "bg-black/5 hover:bg-black/10"}`}
                        >
                          Merge
                        </button>
                      )}
                      <button
                        onClick={() => handleActionToggle(i, "create")}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition ${item.chosenAction === "create" ? "bg-accent text-white" : "bg-black/5 hover:bg-black/10"}`}
                      >
                        Create New
                      </button>
                      <button
                        onClick={() => handleActionToggle(i, "skip")}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition ${item.chosenAction === "skip" ? "bg-red-600 text-white" : "bg-black/5 hover:bg-black/10"}`}
                      >
                        Skip
                      </button>
                    </div>
                  </div>

                  {item.isDuplicate && item.existingRecords.length > 0 ? (
                    <div className="space-y-2">
                      {/* Dropdown to switch targets when multiple possibilities exist */}
                      {item.existingRecords.length > 1 && item.chosenAction === "merge" && (
                        <div className="flex items-center gap-2 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                          <label className="text-xs font-medium text-amber-800 shrink-0" htmlFor={`select-match-${i}`}>
                            ⚠️ Multiple matches found! Select target:
                          </label>
                          <select
                            id={`select-match-${i}`}
                            value={item.selectedExistingId}
                            onChange={(e) => handleTargetIdChange(i, Number(e.target.value))}
                            className="input text-xs py-1 bg-white dark:bg-zinc-900 border"
                          >
                            {item.existingRecords.map((rec) => (
                              <option key={rec.id} value={rec.id}>
                                {rec.firstName} {rec.lastName ?? ""} ({rec.year || "no class year"})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Detail Breakdown comparison block updates instantly based on selected candidate */}
                      {selectedRecord && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white dark:bg-zinc-800 border rounded-lg text-xs">
                          <div className="space-y-1">
                            <div className="font-semibold text-black/40 uppercase tracking-wider text-[10px]">AI Parsed Fields</div>
                            <div>Year: <span className="font-medium">{item.incoming.year || "—"}</span></div>
                            <div>Gender: <span className="font-medium">{item.incoming.gender || "—"}</span></div>
                            <div>Phone: <span className="font-medium">{item.incoming.phone || "—"}</span></div>
                            <div>IG: <span className="font-medium">{item.incoming.igHandle ? `@${item.incoming.igHandle}` : "—"}</span></div>
                          </div>
                          <div className="space-y-1 border-l pl-4 border-black/10">
                            <div className="font-semibold text-amber-600 uppercase tracking-wider text-[10px]">Comparison Target Details</div>
                            <div>Name: <span className="font-medium">{selectedRecord.firstName} {selectedRecord.lastName ?? ""}</span></div>
                            <div>Year: <span className="font-medium">{selectedRecord.year || "—"}</span></div>
                            <div>Phone: <span className="font-medium">{selectedRecord.phone || "—"}</span></div>
                            <div>IG: <span className="font-medium">{selectedRecord.igHandle ? `@${selectedRecord.igHandle}` : "—"}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-500/10 text-emerald-700 text-xs rounded-lg font-medium">
                      ✓ Clean Entry: No matching profile found in the database.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setViewState("input")} disabled={isSaving} className="btn-ghost text-xs">
              Back
            </button>
            <button onClick={handleSaveCommit} disabled={isSaving || items.length === 0} className="btn-primary text-xs">
              {isSaving ? "Saving changes..." : `Commit Roster Entries (${items.filter(x => x.chosenAction !== "skip").length})`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
    </div>
  );
}
