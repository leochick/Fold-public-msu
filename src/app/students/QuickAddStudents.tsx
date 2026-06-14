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
  existingRecord: any | null;
  chosenAction: "create" | "merge" | "skip";
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

        const initialMappedItems = data.items.map((x: any) => ({
          ...x,
          chosenAction: x.isDuplicate ? "merge" : "create",
        }));

        setItems(initialMappedItems);
        setExplanation(data.explanation);
        setViewState("verify");
      } catch (err: any) {
        setError(err.message || "Network transaction failure.");
      }
    });
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
              existingId: x.existingRecord?.id,
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
        setError(err.message || "Failed committing values to table context.");
      }
    });
  };

  return (
    <div className="card space-y-3 border-accent/30">
      <div>
        <h2 className="font-semibold">⚡ AI Quick Add Students</h2>
        <p className="text-xs text-black/60">
          Paste text chunks or messages to ingest multiple student records simultaneously.
        </p>
      </div>

      {viewState === "input" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="input font-sans text-sm"
            placeholder={`Example: "Add Leo Chick, freshman guy, handle @leochick and Sarah Conner soph, phone 555-0101"`}
          />
          <button
            onClick={handleProcessText}
            disabled={isProcessing || !text.trim()}
            className="btn-primary"
          >
            {isProcessing ? "Analyzing content..." : "Process Text"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-black/5 dark:border-white/10">
          {explanation && <p className="text-xs text-black/50 italic">{explanation}</p>}

          <div className="overflow-x-auto border border-black/5 dark:border-white/10 rounded-lg max-h-72">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/5 dark:bg-white/5 sticky top-0 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Extracted Student</th>
                  <th className="p-3">Duplicate Strategy</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5 text-sm">
                    <td className="p-3">
                      <div className="font-medium">{item.incoming.firstName} {item.incoming.lastName ?? ""}</div>
                      <div className="text-xs text-black/40">
                        {[item.incoming.year, item.incoming.gender, item.incoming.igHandle, item.incoming.phone, item.incoming.email].filter(Boolean).join(" • ")}
                      </div>
                    </td>
                    <td className="p-3">
                      {item.isDuplicate ? (
                        <div className="chip bg-amber-500/15 text-amber-700 font-medium">
                          ⚠ Duplication Alert: matches {item.existingRecord?.firstName} {item.existingRecord?.lastName ?? ""}
                        </div>
                      ) : (
                        <div className="chip bg-emerald-500/15 text-emerald-700 font-medium">
                          ✓ Unmatched Roster Entry
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={item.chosenAction}
                        onChange={(e) => {
                          const clone = [...items];
                          clone[i].chosenAction = e.target.value as any;
                          setItems(clone);
                        }}
                        className="input max-w-[160px] py-1 text-xs"
                      >
                        <option value="create">Insert New Profile</option>
                        {item.isDuplicate && <option value="merge">Overwrite / Patch Existing</option>}
                        <option value="skip">Ignore Entry</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setViewState("input")}
              disabled={isSaving}
              className="btn-ghost text-xs"
            >
              Back
            </button>
            <button
              onClick={handleSaveCommit}
              disabled={isSaving || items.length === 0}
              className="btn-primary text-xs"
            >
              {isSaving ? "Saving changes..." : `Commit Records (${items.filter(x => x.chosenAction !== "skip").length})`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
    </div>
  );
}
