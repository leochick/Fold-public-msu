"use client";

import {
  EMPTY_GROUPING_STUDENT_FILTERS,
  GROUPING_COMMUNICATION_FILTERS,
  GROUPING_EXPERIENCE_FILTERS,
  GROUPING_YEAR_FILTERS,
  type GroupingCommunicationFilter,
  type GroupingExperienceFilter,
  type GroupingStudentFilters,
  type GroupingYearFilter,
} from "@/lib/grouping-student-filters";

export default function StudentFiltersCard({
  filters,
  onChange,
}: {
  filters: GroupingStudentFilters;
  onChange: (filters: GroupingStudentFilters) => void;
}) {
  function toggleYear(year: GroupingYearFilter) {
    onChange({
      ...filters,
      years: filters.years.includes(year)
        ? filters.years.filter((value) => value !== year)
        : [...filters.years, year],
    });
  }

  function toggleExperience(experience: GroupingExperienceFilter) {
    onChange({
      ...filters,
      experiences: filters.experiences.includes(experience)
        ? filters.experiences.filter((value) => value !== experience)
        : [...filters.experiences, experience],
    });
  }

  function toggleCommunication(communication: GroupingCommunicationFilter) {
    onChange({
      ...filters,
      communications: filters.communications.includes(communication)
        ? filters.communications.filter((value) => value !== communication)
        : [...filters.communications, communication],
    });
  }

  const hasFilters =
    filters.years.length > 0 ||
    filters.experiences.length > 0 ||
    filters.communications.length > 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        {hasFilters && (
          <button
            type="button"
            className="text-xs text-black/50 dark:text-white/50 hover:underline"
            onClick={() => onChange(EMPTY_GROUPING_STUDENT_FILTERS)}
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
            Year in school
          </p>
          <div className="space-y-1.5">
            {GROUPING_YEAR_FILTERS.map((year) => (
              <label key={year.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filters.years.includes(year.value)}
                  onChange={() => toggleYear(year.value)}
                />
                <span>{year.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">Experiences</p>
          <div className="space-y-1.5">
            {GROUPING_EXPERIENCE_FILTERS.map((experience) => (
              <label key={experience} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filters.experiences.includes(experience)}
                  onChange={() => toggleExperience(experience)}
                />
                <span>{experience}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">Communication</p>
          <div className="space-y-1.5">
            {GROUPING_COMMUNICATION_FILTERS.map((communication) => (
              <label
                key={communication.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filters.communications.includes(communication.value)}
                  onChange={() => toggleCommunication(communication.value)}
                />
                <span>{communication.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
