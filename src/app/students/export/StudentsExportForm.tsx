"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import CheckboxDropdown from "./CheckboxDropdown";
import {
  buildCampusExportRows,
  CAMPUS_EXPORT_COLUMNS,
  CAMPUS_EXPORT_STATUS_OPTIONS,
  downloadCampusExportWorkbook,
  parseCampusImportTemplate,
  type CampusExportAttendance,
  type CampusExportRow,
  type CampusExportSemester,
  type CampusExportStatus,
  type CampusExportStudent,
  type CampusImportTemplate,
} from "@/lib/students-campus-export";

type Phase = "pick" | "parsing" | "ready";

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function statusSummary(selected: CampusExportStatus[]): string {
  if (selected.length === 0) return "None";
  if (selected.length === CAMPUS_EXPORT_STATUS_OPTIONS.length) return "All";
  return CAMPUS_EXPORT_STATUS_OPTIONS.filter((opt) => selected.includes(opt.value))
    .map((opt) => opt.label)
    .join(", ");
}

function semesterSummary(
  selectedIds: number[],
  semesters: CampusExportSemester[]
): string {
  if (selectedIds.length === 0) return "None";
  if (selectedIds.length === semesters.length) return "All";
  const names = semesters
    .filter((semester) => selectedIds.includes(semester.id))
    .map((semester) => semester.name);
  if (names.length <= 2) return names.join(", ");
  return `${names.length} selected`;
}

export default function StudentsExportForm({
  students,
  attendances,
  semesters,
  defaultSemesterIds,
  campusSheetName = "MSU",
}: {
  students: CampusExportStudent[];
  attendances: CampusExportAttendance[];
  semesters: CampusExportSemester[];
  defaultSemesterIds: number[];
  campusSheetName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const templateBufferRef = useRef<ArrayBuffer | null>(null);

  const [phase, setPhase] = useState<Phase>("pick");
  const [template, setTemplate] = useState<CampusImportTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedSemesterIds, setSelectedSemesterIds] = useState<number[]>(defaultSemesterIds);
  const [selectedStatuses, setSelectedStatuses] = useState<CampusExportStatus[]>([
    "outreach",
    "active",
    "engaged",
    "student_leader",
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const selectedSemesters = useMemo(
    () => semesters.filter((semester) => selectedSemesterIds.includes(semester.id)),
    [semesters, selectedSemesterIds]
  );

  const previewRows: CampusExportRow[] = useMemo(() => {
    if (!template) return [];
    return buildCampusExportRows({
      students,
      attendances,
      semesters: selectedSemesters,
      statuses: selectedStatuses,
    });
  }, [template, students, attendances, selectedSemesters, selectedStatuses]);

  const previewColumns = template?.matchedColumns.length
    ? template.matchedColumns
    : [...CAMPUS_EXPORT_COLUMNS];

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
      setError("Please choose an Excel .xlsx file (College Student Database Import template).");
      setPhase("pick");
      return;
    }

    setError(null);
    setExportError(null);
    setPhase("parsing");
    setTemplate(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseCampusImportTemplate(buffer, file.name);
      templateBufferRef.current = buffer;
      setTemplate(parsed);
      setPhase("ready");
    } catch (err) {
      templateBufferRef.current = null;
      setTemplate(null);
      setPhase("pick");
      setError(err instanceof Error ? err.message : "Could not read this workbook");
    }
  }, []);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void handleFile(event.dataTransfer.files?.[0]);
  }

  function resetUpload() {
    templateBufferRef.current = null;
    setTemplate(null);
    setPhase("pick");
    setError(null);
    setExportError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleExport() {
    if (!template || !templateBufferRef.current || isExporting) return;
    if (previewRows.length === 0) {
      setExportError("No students match the current filters.");
      return;
    }

    setIsExporting(true);
    setExportError(null);
    try {
      await downloadCampusExportWorkbook({
        templateData: templateBufferRef.current,
        templateSheetName: template.templateSheetName,
        headers: template.headers,
        rows: previewRows,
        campusSheetName,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Export students</h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Upload the College Student Database Import template, preview Fold students mapped into
            its columns, then export a filled .xlsx.
          </p>
        </div>
        <Link href="/students" className="btn btn-ghost shrink-0">
          ← Students
        </Link>
      </div>

      {phase !== "ready" ? (
        <div
          className={`card border-dashed border-2 ${
            dragOver ? "border-accent bg-accent/5" : "border-black/15 dark:border-white/15"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm font-medium">
              {phase === "parsing" ? "Reading template…" : "Drop an .xlsx template here"}
            </p>
            <p className="text-xs text-black/50 dark:text-white/50 max-w-md">
              Use the campus import workbook (sheets like README + Template CampusName). Fold will
              fill student fields as best it can from roster data.
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={phase === "parsing"}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
        </div>
      ) : (
        <>
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{template?.fileName}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  Sheet “{template?.templateSheetName}” · {previewColumns.length} columns
                </p>
              </div>
              <button type="button" className="btn btn-ghost text-sm" onClick={resetUpload}>
                Change file
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <CheckboxDropdown
                label="Semesters"
                summary={semesterSummary(selectedSemesterIds, semesters)}
              >
                {semesters.length === 0 ? (
                  <p className="text-xs text-black/50 dark:text-white/50 px-1 py-2">
                    No semesters available.
                  </p>
                ) : (
                  semesters.map((semester) => (
                    <label
                      key={semester.id}
                      className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-accent"
                        checked={selectedSemesterIds.includes(semester.id)}
                        onChange={() =>
                          setSelectedSemesterIds((prev) => toggleValue(prev, semester.id))
                        }
                      />
                      <span className="truncate">{semester.name}</span>
                    </label>
                  ))
                )}
              </CheckboxDropdown>

              <CheckboxDropdown label="Status" summary={statusSummary(selectedStatuses)}>
                {CAMPUS_EXPORT_STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-accent"
                      checked={selectedStatuses.includes(option.value)}
                      onChange={() =>
                        setSelectedStatuses((prev) => toggleValue(prev, option.value))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </CheckboxDropdown>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-sm text-black/60 dark:text-white/60">
                {previewRows.length} student{previewRows.length === 1 ? "" : "s"} in preview
              </p>
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isExporting || previewRows.length === 0}
                  onClick={() => void handleExport()}
                >
                  {isExporting ? "Exporting…" : "Export"}
                </button>
                {exportError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            {previewRows.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50 py-6 text-center">
                No students match the selected semesters and statuses.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-left">
                    <th className="py-2 pr-3 font-medium whitespace-nowrap">Status</th>
                    {previewColumns.map((column) => (
                      <th key={column} className="py-2 pr-3 font-medium whitespace-nowrap">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={row.studentId}
                      className="border-b border-black/5 dark:border-white/5 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-black/60 dark:text-white/60">
                        {CAMPUS_EXPORT_STATUS_OPTIONS.find((opt) => opt.value === row.status)
                          ?.label ?? row.statusLabel}
                      </td>
                      {previewColumns.map((column) => {
                        const value = row.values[column];
                        const display =
                          typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : String(value);
                        return (
                          <td key={column} className="py-2 pr-3 whitespace-nowrap">
                            {display || (
                              <span className="text-black/30 dark:text-white/30">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
