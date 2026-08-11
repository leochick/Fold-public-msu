import type ExcelJS from "exceljs";
import {
  classifyPrimaryEngagement,
  ENGAGEMENT_FUNNEL_LABELS,
  type EngagementFunnelStage,
} from "@/lib/dashboard-engagement";
import { getStudentStatuses } from "@/lib/grouping-status";

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default;
}

/** Canonical columns from the College Student Database Import template. */
export const CAMPUS_EXPORT_COLUMNS = [
  "Name",
  "Gender",
  "Graduating Year",
  "Faith Status",
  "Playbook",
  "Became Christian",
  "Engagement",
  "Student Lead",
  "C101 Status",
  "Baptized",
  "Baptized Date",
  "Applied to CPI?",
  "Testimony Completed",
  "Plans to Stay in A2N",
] as const;

export type CampusExportColumn = (typeof CAMPUS_EXPORT_COLUMNS)[number];

export type CampusExportStatus = EngagementFunnelStage;

export const CAMPUS_EXPORT_STATUS_OPTIONS: Array<{
  value: CampusExportStatus;
  label: string;
}> = [
  { value: "outreach", label: "Outreach" },
  { value: "active", label: "Active" },
  { value: "engaged", label: "Engaged" },
  { value: "student_leader", label: "Student Leader" },
];

export type CampusExportSemester = {
  id: number;
  name: string;
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
};

export type CampusExportAttendance = {
  studentId: number;
  eventType: string | null;
  /** YYYY-MM-DD */
  eventDate: string;
};

export type CampusExportStudent = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  year: string | null;
  newsletter: boolean;
  courseMaterial: string[] | null;
  salvationDecisionAt: string | null;
  ledToChristByStudentId: number | null;
  ledToChristByStaffId: number | null;
};

export type CampusExportRow = {
  studentId: number;
  status: CampusExportStatus;
  statusLabel: string;
  values: Record<CampusExportColumn, string | number | boolean>;
};

export type CampusImportTemplate = {
  fileName: string;
  templateSheetName: string;
  headers: string[];
  /** Columns from the template that we recognize for export. */
  matchedColumns: CampusExportColumn[];
};

const TEMPLATE_SHEET_HINT = /template/i;

const EVENT_TYPE_TO_ENGAGEMENT: Array<{ match: RegExp; label: string }> = [
  { match: /\bsws\b|sunday\s*worship|large\s*group|weekly\b/i, label: "SWS" },
  { match: /\baym\b/i, label: "AYM" },
  { match: /\becm\b/i, label: "ECM" },
  { match: /midweek|bible\s*study/i, label: "Midweek Bible Study" },
  { match: /playbook/i, label: "Playbook" },
];

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result != null) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
}

function normalizeHeader(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

const HEADER_ALIASES: Record<string, CampusExportColumn> = Object.fromEntries(
  CAMPUS_EXPORT_COLUMNS.map((col) => [normalizeHeader(col), col])
) as Record<string, CampusExportColumn>;

export function matchCampusExportColumn(header: string): CampusExportColumn | null {
  return HEADER_ALIASES[normalizeHeader(header)] ?? null;
}

function findTemplateSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const byName =
    workbook.worksheets.find((sheet) => TEMPLATE_SHEET_HINT.test(sheet.name)) ??
    workbook.worksheets.find((sheet) => {
      const headers = readHeaderRow(sheet);
      return headers.some((h) => matchCampusExportColumn(h) === "Name");
    });
  if (!byName) {
    throw new Error(
      'Could not find a template sheet. Expected a sheet named like "Template CampusName" with a Name column.'
    );
  }
  return byName;
}

function readHeaderRow(sheet: ExcelJS.Worksheet): string[] {
  const row = sheet.getRow(1);
  const headers: string[] = [];
  const maxCol = Math.max(sheet.columnCount || 0, 14);
  for (let col = 1; col <= maxCol; col++) {
    const text = cellText(row.getCell(col).value);
    if (!text && col > 1 && headers.every((h) => !h)) continue;
    if (!text && col > headers.length + 1) break;
    headers.push(text);
  }
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  return headers;
}

export async function parseCampusImportTemplate(
  data: ArrayBuffer,
  fileName: string
): Promise<CampusImportTemplate> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);

  const sheet = findTemplateSheet(workbook);
  const headers = readHeaderRow(sheet);
  if (headers.length === 0) {
    throw new Error("The template sheet has no header row.");
  }

  const matchedColumns = headers
    .map((header) => matchCampusExportColumn(header))
    .filter((col): col is CampusExportColumn => col != null);

  if (!matchedColumns.includes("Name")) {
    throw new Error('Template must include a "Name" column.');
  }

  return {
    fileName,
    templateSheetName: sheet.name,
    headers,
    matchedColumns,
  };
}

export function dateInRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function mapEventTypeToEngagementLabel(eventType: string | null | undefined): string | null {
  const raw = (eventType ?? "").trim();
  if (!raw) return null;
  for (const rule of EVENT_TYPE_TO_ENGAGEMENT) {
    if (rule.match.test(raw)) return rule.label;
  }
  return null;
}

export function formatEngagementLabels(eventTypes: Array<string | null | undefined>): string {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const type of eventTypes) {
    const label = mapEventTypeToEngagementLabel(type);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels.join(", ");
}

export function formatGender(gender: "M" | "F" | null | undefined): string {
  if (gender === "M") return "Male";
  if (gender === "F") return "Female";
  return "";
}

export function formatStudentName(firstName: string, lastName: string | null | undefined): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

/** Infer graduating calendar year from class standing relative to a semester end year. */
export function inferGraduatingYear(
  year: string | null | undefined,
  referenceEndYear: number | null
): number | "" {
  if (referenceEndYear == null || !Number.isFinite(referenceEndYear)) return "";
  switch ((year ?? "").toLowerCase()) {
    case "senior":
      return referenceEndYear;
    case "junior":
      return referenceEndYear + 1;
    case "sophomore":
      return referenceEndYear + 2;
    case "freshman":
      return referenceEndYear + 3;
    default:
      return "";
  }
}

export function formatFaithStatus(student: {
  salvationDecisionAt: string | null;
  ledToChristByStudentId: number | null;
  ledToChristByStaffId: number | null;
}): "Christian" | "Non-Christian" | "Unknown" {
  if (
    student.salvationDecisionAt ||
    student.ledToChristByStudentId != null ||
    student.ledToChristByStaffId != null
  ) {
    return "Christian";
  }
  return "Unknown";
}

/** Map a YYYY-MM-DD (or ISO) date to template "Became Christian" labels like "Fall 2025". */
export function formatBecameChristian(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const day = isoDate.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month >= 8) return `Fall ${year}`;
  if (month <= 5) return `Spring ${year}`;
  return `Spring ${year}`;
}

export function formatC101Status(courseMaterial: string[] | null | undefined): string {
  if (courseMaterial?.includes("Course 101")) return "Completed";
  return "Not started";
}

function referenceEndYearFromSemesters(semesters: CampusExportSemester[]): number | null {
  if (semesters.length === 0) return null;
  const latest = semesters.reduce((best, cur) => (cur.to > best.to ? cur : best));
  const year = Number(latest.to.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function attendancesForSemesters(
  attendances: CampusExportAttendance[],
  studentId: number,
  semesters: CampusExportSemester[]
): CampusExportAttendance[] {
  return attendances.filter(
    (row) =>
      row.studentId === studentId &&
      semesters.some((semester) => dateInRange(row.eventDate, semester.from, semester.to))
  );
}

export function buildCampusExportRows(params: {
  students: CampusExportStudent[];
  attendances: CampusExportAttendance[];
  semesters: CampusExportSemester[];
  statuses: CampusExportStatus[];
}): CampusExportRow[] {
  const { students, attendances, semesters, statuses } = params;
  if (semesters.length === 0 || statuses.length === 0) return [];

  const statusSet = new Set(statuses);
  const refYear = referenceEndYearFromSemesters(semesters);
  const rows: CampusExportRow[] = [];

  for (const student of students) {
    const inRange = attendancesForSemesters(attendances, student.id, semesters);
    const eventTypes = inRange.map((row) => row.eventType);
    const attendanceCount = inRange.length;
    const matchedStatuses = getStudentStatuses({
      courseMaterial: student.courseMaterial,
      attendanceCountInRange: attendanceCount,
      attendedEventTypesInRange: eventTypes.map((type) => type ?? ""),
      newsletter: student.newsletter,
    });
    if (!matchedStatuses.some((status) => statusSet.has(status))) continue;

    const status =
      classifyPrimaryEngagement({
        courseMaterial: student.courseMaterial,
        attendanceCount,
        eventTypes,
        newsletter: student.newsletter,
      }) ?? matchedStatuses[0];
    if (!status) continue;

    const values: Record<CampusExportColumn, string | number | boolean> = {
      Name: formatStudentName(student.firstName, student.lastName),
      Gender: formatGender(student.gender),
      "Graduating Year": inferGraduatingYear(student.year, refYear),
      "Faith Status": formatFaithStatus(student),
      Playbook: "Unknown",
      "Became Christian": formatBecameChristian(student.salvationDecisionAt),
      Engagement: formatEngagementLabels(eventTypes),
      "Student Lead": Boolean(student.courseMaterial?.includes("Student Leader")),
      "C101 Status": formatC101Status(student.courseMaterial),
      Baptized: false,
      "Baptized Date": "",
      "Applied to CPI?": false,
      "Testimony Completed": false,
      "Plans to Stay in A2N": false,
    };

    rows.push({
      studentId: student.id,
      status,
      statusLabel: ENGAGEMENT_FUNNEL_LABELS[status],
      values,
    });
  }

  rows.sort((a, b) => String(a.values.Name).localeCompare(String(b.values.Name)));
  return rows;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "Campus";
}

export function campusExportFilename(opts?: { campusName?: string }): string {
  const date = new Date().toISOString().slice(0, 10);
  const campus = sanitizeFilename(opts?.campusName ?? "Campus");
  return `College-Student-Database-${campus}-${date}.xlsx`;
}

function clearDataRows(sheet: ExcelJS.Worksheet) {
  const rowCount = sheet.rowCount || 0;
  for (let r = 2; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null;
    });
  }
}

function writeExportRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  headers: string[],
  values: Record<CampusExportColumn, string | number | boolean>
) {
  const row = sheet.getRow(rowIndex);
  headers.forEach((header, index) => {
    const col = matchCampusExportColumn(header);
    if (!col) return;
    const value = values[col];
    row.getCell(index + 1).value = value === "" ? null : value;
  });
  row.commit();
}

/**
 * Fill the uploaded campus-import template with export rows.
 * Keeps README (if present) and a single filled campus sheet; drops other campus samples.
 */
export async function buildCampusExportWorkbook(params: {
  templateData: ArrayBuffer;
  templateSheetName: string;
  headers: string[];
  rows: CampusExportRow[];
  campusSheetName?: string;
}): Promise<ExcelJS.Workbook> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(params.templateData as unknown as ExcelJS.Buffer);
  workbook.creator = "Fold";
  workbook.modified = new Date();

  const template =
    workbook.getWorksheet(params.templateSheetName) ?? findTemplateSheet(workbook);
  const campusName = (params.campusSheetName ?? "Campus").trim() || "Campus";

  clearDataRows(template);
  params.rows.forEach((exportRow, index) => {
    writeExportRow(template, index + 2, params.headers, exportRow.values);
  });

  if (template.name !== campusName) {
    template.name = campusName;
  }

  const keep = new Set(
    workbook.worksheets
      .filter((sheet) => /readme/i.test(sheet.name) || sheet === template)
      .map((sheet) => sheet.name)
  );
  for (const sheet of [...workbook.worksheets]) {
    if (!keep.has(sheet.name)) {
      workbook.removeWorksheet(sheet.id);
    }
  }

  return workbook;
}

export async function downloadCampusExportWorkbook(params: {
  templateData: ArrayBuffer;
  templateSheetName: string;
  headers: string[];
  rows: CampusExportRow[];
  campusSheetName?: string;
}): Promise<void> {
  const workbook = await buildCampusExportWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = campusExportFilename({ campusName: params.campusSheetName });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
