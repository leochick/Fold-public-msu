"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  downloadGroupingWorkbook,
  type GroupingExportSnapshot,
} from "@/lib/grouping-export";

type GroupingExportContextValue = {
  snapshot: GroupingExportSnapshot | null;
  setSnapshot: (snapshot: GroupingExportSnapshot | null) => void;
};

const GroupingExportContext = createContext<GroupingExportContextValue | null>(null);

export function GroupingExportProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshotState] = useState<GroupingExportSnapshot | null>(null);
  const setSnapshot = useCallback((next: GroupingExportSnapshot | null) => {
    setSnapshotState(next);
  }, []);

  const value = useMemo(() => ({ snapshot, setSnapshot }), [snapshot, setSnapshot]);

  return (
    <GroupingExportContext.Provider value={value}>{children}</GroupingExportContext.Provider>
  );
}

export function useGroupingExport() {
  const context = useContext(GroupingExportContext);
  if (!context) {
    throw new Error("useGroupingExport must be used within GroupingExportProvider");
  }
  return context;
}

export function GroupingsPageHeader() {
  const { snapshot } = useGroupingExport();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    if (!snapshot || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      await downloadGroupingWorkbook(snapshot);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <h1 className="text-2xl font-bold">Groupings</h1>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={handleExport}
          disabled={!snapshot || isExporting}
          title={snapshot ? "Export the current grouping to Excel" : "Select a grouping to export"}
        >
          {isExporting ? "Exporting…" : "Export to .xlsx"}
        </button>
        {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
      </div>
    </div>
  );
}
