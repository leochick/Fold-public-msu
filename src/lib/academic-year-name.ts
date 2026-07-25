/** Academic year labels like 2025-26 (20XX-YY). */
export const ACADEMIC_YEAR_NAME_PATTERN = /^20\d{2}-\d{2}$/;

export function isValidAcademicYearName(name: string): boolean {
  return ACADEMIC_YEAR_NAME_PATTERN.test(name.trim());
}
