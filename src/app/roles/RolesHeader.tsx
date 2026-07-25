"use client";

import { useState } from "react";
import {
  downloadRoleBoardWorkbook,
  type RoleBoardExportSnapshot,
} from "@/lib/role-boards-export";
import type { RoleBoardRow } from "../../../drizzle/schema";
import type { RoleBoardPersonOption } from "@/server/roles";
import RolesImportModal from "./RolesImportModal";

export default function RolesHeader({
  snapshot,
  boardId,
  personOptions,
  onImported,
}: {
  snapshot: RoleBoardExportSnapshot | null;
  boardId?: number;
  personOptions?: RoleBoardPersonOption[];
  onImported?: (next: { rows: RoleBoardRow[]; personColumnCount: number }) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    if (!snapshot || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      await downloadRoleBoardWorkbook(snapshot);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  const canImport = boardId != null && personOptions != null && onImported != null;

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Roles</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          {snapshot
            ? `Role assignments for ${snapshot.viewName}.`
            : "Assign people to roles in the current semester."}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {canImport ? (
            <RolesImportModal
              boardId={boardId}
              personOptions={personOptions}
              onImported={onImported}
            />
          ) : (
            <button
              type="button"
              className="btn btn-ghost shrink-0"
              disabled
              title="Select a semester to import"
            >
              Import
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={handleExport}
            disabled={!snapshot || isExporting}
            title={
              snapshot ? "Export roles for this semester to Excel" : "Select a semester to export"
            }
          >
            {isExporting ? "Exporting…" : "Export to .xlsx"}
          </button>
        </div>
        {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
      </div>
    </div>
  );
}
