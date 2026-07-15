"use client";

import { useState } from "react";
import {
  downloadStaffAllocationWorkbook,
  type StaffAllocationExportSnapshot,
} from "@/lib/staff-allocation-export";

export default function StaffAllocationHeader({
  snapshot,
}: {
  snapshot: StaffAllocationExportSnapshot | null;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    if (!snapshot || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      await downloadStaffAllocationWorkbook(snapshot);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Staff Allocation</h1>
        <p className="text-sm text-black/60 mt-1">
          {snapshot
            ? `Roles and grouping placements for each staff member in ${snapshot.viewName}.`
            : "Roles and grouping placements for each staff member in the current view."}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={handleExport}
          disabled={!snapshot || isExporting}
          title={
            snapshot
              ? "Export staff allocation for this view to Excel"
              : "Select a view to export"
          }
        >
          {isExporting ? "Exporting…" : "Export to .xlsx"}
        </button>
        {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
      </div>
    </div>
  );
}
