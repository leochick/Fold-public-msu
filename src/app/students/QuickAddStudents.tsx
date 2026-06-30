"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BatchRosterReviewList, { type BatchRosterItem } from "./BatchRosterReviewList";

export default function QuickAddStudents() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [items, setItems] = useState<BatchRosterItem[]>([]);
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

        const initialMappedItems = data.items.map((x: any) => ({
          ...x,
          chosenAction: x.isDuplicate ? "merge" : "create",
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
          Add students, sync course completions, newsletter/Groupme flags, or apply bulk updates. Review merge targets and field changes before committing.
        </p>
      </div>

      {viewState === "input" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="input font-sans text-sm"
            placeholder={`e.g. "Add Grace" or "Mark Course 101 completed for: Caleb, Rip, Katie" or "Add to Groupme: Maya, Jordan"`}
          />
          <button onClick={handleProcessText} disabled={isProcessing || !text.trim()} className="btn-primary">
            {isProcessing ? "Analyzing content..." : "Process Text"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-black/5 dark:border-white/10">
          <BatchRosterReviewList
            items={items}
            explanation={explanation}
            onActionToggle={handleActionToggle}
            onTargetIdChange={handleTargetIdChange}
            mergeButtonLabel="Merge"
          />

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
