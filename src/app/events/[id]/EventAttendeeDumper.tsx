"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BatchRosterReviewList, { type BatchRosterItem } from "../../students/BatchRosterReviewList";

export default function EventAttendeeDumper({ eventId }: { eventId: number }) {
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
        const res = await fetch("/api/events/parse-attendees-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to parse text input.");

        const initialMappedItems = data.items.map((x: any) => ({
          ...x,
          chosenAction: x.isDuplicate ? "merge" : "create",
          selectedExistingId: x.isDuplicate ? x.existingRecords[0]?.id : undefined,
        }));

        setItems(initialMappedItems);
        setExplanation(data.explanation);
        setViewState("verify");
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred during processing.");
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
        const res = await fetch("/api/events/commit-attendees-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            items: items.map((x) => ({
              action: x.chosenAction,
              incoming: x.incoming,
              selectedExistingId: x.chosenAction === "merge" ? x.selectedExistingId : undefined,
            })),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save attendee updates.");

        setText("");
        setItems([]);
        setViewState("input");
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to finalize database records.");
      }
    });
  };

  return (
    <div className="card space-y-3 border-accent/20">
      <div>
        <h2 className="font-semibold text-base">⚡ Paste Unstructured Attendees List</h2>
        <p className="text-xs text-black/60">
          Paste any message block or text dump. The system automatically handles deduplication and matches existing students.
        </p>
      </div>

      {viewState === "input" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="input font-sans text-sm"
            placeholder={`e.g. "Grace, Leo Chick, and Sarah Conner (555-0101)"`}
          />
          <button
            onClick={handleProcessText}
            disabled={isProcessing || !text.trim()}
            className="btn-primary w-full sm:w-auto"
          >
            {isProcessing ? "Analyzing Roster Content..." : "Process Text"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-black/5 dark:border-white/10">
          <BatchRosterReviewList
            items={items}
            explanation={explanation}
            onActionToggle={handleActionToggle}
            onTargetIdChange={handleTargetIdChange}
            mergeButtonLabel="Check In & Merge"
          />

          <div className="flex gap-2 justify-end">
            <button onClick={() => setViewState("input")} disabled={isSaving} className="btn-ghost text-xs">
              Back
            </button>
            <button onClick={handleSaveCommit} disabled={isSaving || items.length === 0} className="btn-primary text-xs">
              {isSaving ? "Processing..." : `Commit Changes & Check In (${items.filter((x) => x.chosenAction !== "skip").length})`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
    </div>
  );
}
