"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MergePreviewPanel from "../MergePreviewPanel";
import {
  buildMergePreview,
  type MergeEditableField,
  type MergeStudentRecord,
} from "@/lib/student-merge";

type MergeSuggestion = {
  candidate: {
    studentId: number;
    confidence: "high" | "medium" | "low";
    score: number;
    reasons: string[];
  };
  student: MergeStudentRecord;
};

const REASON_LABELS: Record<string, string> = {
  phone_last7: "Phone",
  email_normalized: "Email",
  ig_exact: "Instagram",
  name_fuzzy: "Name",
  recent_add: "Recent",
};

function formatName(student: Pick<MergeStudentRecord, "firstName" | "lastName">) {
  return `${student.firstName}${student.lastName ? ` ${student.lastName}` : ""}`.trim();
}

export default function StudentMergeModal({
  studentId,
  keepStudent,
}: {
  studentId: number;
  keepStudent: MergeStudentRecord;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<MergeEditableField, string>>>({});
  const [isSaving, startSavingTransition] = useTransition();

  const selected = suggestions.find((s) => s.student.id === selectedId)?.student ?? null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setSelectedId(null);
    setOverrides({});
    fetch(`/api/students/${studentId}/merge-suggestions`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load suggestions.");
        setSuggestions(data.suggestions ?? []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, studentId]);

  const preview = useMemo(() => {
    if (!selected) return null;
    return buildMergePreview(keepStudent, selected, overrides);
  }, [keepStudent, selected, overrides]);

  const handleOverrideChange = (key: MergeEditableField, value: string) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (!selected) return;
    setError("");
    startSavingTransition(async () => {
      try {
        const res = await fetch(`/api/students/${studentId}/merge`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mergeWithId: selected.id,
            overrides,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Merge failed.");
        setOpen(false);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Merge failed.");
      }
    });
  };

  const canConfirm =
    !!selected &&
    !!preview &&
    preview.fields
      .filter((field) => field.editable)
      .every((field) => {
        const value = overrides[field.key as MergeEditableField] ?? field.value;
        return value && value !== "—";
      });

  return (
    <>
      <button type="button" className="btn-ghost text-amber-700" onClick={() => setOpen(true)}>
        Merge
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-4 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Merge student</h2>
                <p className="text-xs text-black/60 mt-1">
                  Combine another record into {formatName(keepStudent)}. Attendance, contacts, and ride
                  history will be merged; the other record will be deleted.
                </p>
              </div>
              <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-black/50">Loading suggested matches…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-black/50">No similar students found to merge.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="label">Suggested students</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {suggestions.map(({ candidate, student }) => {
                      const active = selectedId === student.id;
                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(student.id);
                            setOverrides({});
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition ${
                            active
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-black/10 hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">{formatName(student)}</div>
                              <div className="text-xs text-black/50 mt-0.5">
                                {[student.email, student.phone].filter(Boolean).join(" · ") || "No contact info"}
                              </div>
                            </div>
                            <span className="chip text-[10px] uppercase">{candidate.confidence}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {candidate.reasons.map((reason) => (
                              <span key={reason} className="chip text-[10px]">
                                {REASON_LABELS[reason] ?? reason}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selected && preview && (
                  <MergePreviewPanel
                    fields={preview.fields}
                    keepLabel={formatName(keepStudent)}
                    mergeLabel={formatName(selected)}
                    overrides={overrides}
                    onOverrideChange={handleOverrideChange}
                  />
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/10">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={isSaving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirm}
                disabled={!canConfirm || isSaving}
              >
                {isSaving ? "Merging…" : "Confirm merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
