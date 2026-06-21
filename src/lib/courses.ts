export const COURSE_MATERIAL_OPTIONS = [
  "Course 101",
  "ERT",
  "Sixth Hour",
  "Connection Team",
  "Student Leader",
] as const;

export type CourseMaterial = (typeof COURSE_MATERIAL_OPTIONS)[number];
