"use client";

import { useCallback, useRef, useState, useTransition, type DragEvent } from "react";
import type { RoleBoardRow } from "../../../drizzle/schema";
import {
  parseRoleBoardWorkbook,
  roleBoardRowsFromImportPreview,
  type RoleBoardImportPersonOption,
  type RoleBoardImportPreview,
} from "@/lib/role-boards-import";
import { updateRoleBoardAction } from "../roles-actions";

type Phase = "pick" | "uploading" | "preview" | "importing";

export default function RolesImportModal({
  boardId,
  personOptions,
  disabled,
  onImported,
}: {
  boardId: number;
  personOptions: RoleBoardImportPersonOption[];
  disabled?: boolean;
  onImported: (next: { rows: RoleBoardRow[]; personColumnCount: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoleBoardImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();

  function reset() {
    setPhase("pick");
    setFileName(null);
    setPreview(null);
    setError(null);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (phase === "uploading" || phase === "importing") return;
    setOpen(false);
    reset();
  }

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
        setError("Please choose an Excel .xlsx file exported from Fold Roles.");
        setPhase("pick");
        return;
      }

      setError(null);
      setFileName(file.name);
      setPhase("uploading");
      setPreview(null);

      try {
        const buffer = await file.arrayBuffer();
        const next = await parseRoleBoardWorkbook(buffer, personOptions);
        setPreview(next);
        setPhase("preview");
      } catch (err) {
        setPreview(null);
        setPhase("pick");
        setError(err instanceof Error ? err.message : "Could not read this workbook");
      }
    },
    [personOptions]
  );

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    void handleFile(file);
  }

  function confirmImport() {
    if (!preview || phase === "importing") return;
    setPhase("importing");
    setError(null);
    const payload = roleBoardRowsFromImportPreview(preview);

    startTransition(async () => {
      try {
        await updateRoleBoardAction(boardId, {
          personColumnCount: payload.personColumnCount,
          rows: payload.rows,
        });
        onImported(payload);
        setOpen(false);
        reset();
      } catch (err) {
        setPhase("preview");
        setError(err instanceof Error ? err.message : "Could not import roles");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost shrink-0"
        disabled={disabled}
        title={disabled ? "Select a semester to import" : "Import roles from Excel"}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Import
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 rounded-xl border border-black/10 dark:border-white/10 bg-paper dark:bg-ink p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Import roles</h2>
                <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                  Upload a Fold Roles Excel file. Existing roles for this semester will be replaced.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={close}
                disabled={phase === "uploading" || phase === "importing"}
              >
                Close
              </button>
            </div>

            {(phase === "pick" || phase === "uploading") && (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onClick={() => phase === "pick" && inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                }}
                onDrop={onDrop}
                className={`rounded-xl border border-dashed px-4 py-10 text-center transition ${
                  dragOver
                    ? "border-accent bg-accent/5"
                    : "border-black/15 dark:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                } ${phase === "uploading" ? "pointer-events-none opacity-80" : "cursor-pointer"}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
                {phase === "uploading" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Uploading {fileName}…</p>
                    <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
                    </div>
                    <p className="text-xs text-black/50 dark:text-white/50">Reading RolesResp sheet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Drop an .xlsx file here</p>
                    <p className="text-xs text-black/50 dark:text-white/50">
                      or click to choose a Fold Roles export
                    </p>
                  </div>
                )}
              </div>
            )}

            {phase === "preview" && preview && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-black/60 dark:text-white/60">
                  {fileName && <span className="chip">{fileName}</span>}
                  {preview.sourceLabel && <span className="chip">From {preview.sourceLabel}</span>}
                  <span className="chip">{preview.roleCount} roles</span>
                  <span className="chip">{preview.groupCount} groups</span>
                  <span className="chip">{preview.matchedPeople} people matched</span>
                  {preview.unmatchedPeople > 0 && (
                    <span className="chip text-amber-700 dark:text-amber-300">
                      {preview.unmatchedPeople} unmatched
                    </span>
                  )}
                  {preview.ambiguousPeople > 0 && (
                    <span className="chip text-amber-700 dark:text-amber-300">
                      {preview.ambiguousPeople} ambiguous
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-black/[0.04] dark:bg-white/[0.06] text-left text-xs uppercase tracking-wide text-black/60 dark:text-white/60">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Role</th>
                        <th className="px-3 py-2 font-semibold">People</th>
                        <th className="px-3 py-2 font-semibold">Responsibilities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, index) =>
                        row.kind === "subheader" ? (
                          <tr key={`s-${index}`}>
                            <td
                              colSpan={3}
                              className="bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black/60 dark:text-white/60"
                            >
                              {row.name}
                            </td>
                          </tr>
                        ) : (
                          <tr
                            key={`r-${index}`}
                            className="border-t border-black/5 dark:border-white/10 align-top"
                          >
                            <td className="px-3 py-2 font-medium">{row.name}</td>
                            <td className="px-3 py-2">
                              {row.people.length === 0 ? (
                                <span className="text-black/30">—</span>
                              ) : (
                                <ul className="m-0 list-none space-y-1 p-0">
                                  {row.people.map((person) => (
                                    <li key={`${person.name}-${person.status}`}>
                                      <span>{person.name}</span>
                                      {person.status !== "matched" && (
                                        <span className="ml-1 text-[10px] uppercase text-amber-700 dark:text-amber-300">
                                          {person.status}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-3 py-2 text-black/70 dark:text-white/70 whitespace-pre-wrap">
                              {row.responsibilities.length > 0
                                ? row.responsibilities.map((item) => `• ${item}`).join("\n")
                                : "—"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost text-xs px-2 py-1"
                  onClick={() => {
                    reset();
                  }}
                >
                  Choose a different file
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={close}
                disabled={phase === "uploading" || phase === "importing"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmImport}
                disabled={phase !== "preview" || !preview}
              >
                {phase === "importing" ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
