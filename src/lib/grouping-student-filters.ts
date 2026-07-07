import type { Student } from "../../drizzle/schema";

export const GROUPING_YEAR_FILTERS = [
  { value: "freshman" as const, label: "Freshmen" },
  { value: "sophomore" as const, label: "Sophomores" },
  { value: "junior" as const, label: "Juniors" },
  { value: "senior" as const, label: "Seniors" },
];

export const GROUPING_EXPERIENCE_FILTERS = [
  "Course 101",
  "Sixth Hour",
  "ERT",
  "Connection Team",
] as const;

export const GROUPING_COMMUNICATION_FILTERS = [
  { value: "newsletter" as const, label: "Newsletter" },
  { value: "groupme" as const, label: "GroupMe" },
];

export type GroupingYearFilter = (typeof GROUPING_YEAR_FILTERS)[number]["value"];
export type GroupingExperienceFilter = (typeof GROUPING_EXPERIENCE_FILTERS)[number];
export type GroupingCommunicationFilter =
  (typeof GROUPING_COMMUNICATION_FILTERS)[number]["value"];

export type GroupingStudentFilters = {
  years: GroupingYearFilter[];
  experiences: GroupingExperienceFilter[];
  communications: GroupingCommunicationFilter[];
};

export const EMPTY_GROUPING_STUDENT_FILTERS: GroupingStudentFilters = {
  years: [],
  experiences: [],
  communications: [],
};

type FilterableStudent = Pick<
  Student,
  "year" | "courseMaterial" | "newsletter" | "groupme"
>;

export function studentMatchesFilters(
  student: FilterableStudent,
  filters: GroupingStudentFilters
): boolean {
  if (filters.years.length > 0) {
    if (!student.year || !filters.years.includes(student.year as GroupingYearFilter)) {
      return false;
    }
  }

  if (filters.experiences.length > 0) {
    const courses = student.courseMaterial ?? [];
    if (!filters.experiences.some((experience) => courses.includes(experience))) {
      return false;
    }
  }

  if (filters.communications.length > 0) {
    const matches =
      (filters.communications.includes("newsletter") && student.newsletter) ||
      (filters.communications.includes("groupme") && student.groupme);
    if (!matches) return false;
  }

  return true;
}
