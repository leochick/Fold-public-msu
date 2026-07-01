"use client";

import type { MergeEditableField, MergePreviewField } from "@/lib/student-merge";

export default function MergePreviewPanel({
  fields,
  keepLabel,
  mergeLabel,
  overrides,
  onOverrideChange,
}: {
  fields: MergePreviewField[];
  keepLabel: string;
  mergeLabel: string;
  overrides: Partial<Record<MergeEditableField, string>>;
  onOverrideChange: (key: MergeEditableField, value: string) => void;
}) {
  return (
    <div className="p-3 border rounded-lg text-xs space-y-3 bg-amber-500/5 border-amber-500/20">
      <div className="font-semibold uppercase tracking-wider text-[10px] text-amber-700">
        Merge preview
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white dark:bg-zinc-800 border rounded-lg">
        <div className="space-y-1">
          <div className="font-semibold text-black/40 uppercase tracking-wider text-[10px]">Keeping</div>
          <div className="font-medium">{keepLabel}</div>
        </div>
        <div className="space-y-1 border-l pl-4 border-black/10">
          <div className="font-semibold text-amber-600 uppercase tracking-wider text-[10px]">Merging in</div>
          <div className="font-medium">{mergeLabel}</div>
        </div>
      </div>

      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.key}
            className={`rounded-lg border p-2 ${
              field.conflict ? "border-amber-400/50 bg-amber-500/10" : "border-black/5 dark:border-white/10"
            }`}
          >
            <div className="font-medium text-black/70 mb-1">{field.label}</div>
            {field.conflict ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-black/40">{keepLabel}:</span>
                  <span className="text-black/60">{field.left}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-black/40">{mergeLabel}:</span>
                  <span className="text-black/60">{field.right}</span>
                </div>
                {field.editable ? (
                  <input
                    className="input text-xs py-1"
                    value={overrides[field.key as MergeEditableField] ?? (field.value === "—" ? "" : field.value)}
                    onChange={(e) => onOverrideChange(field.key as MergeEditableField, e.target.value)}
                    placeholder={`Choose final ${field.label.toLowerCase()}`}
                  />
                ) : (
                  <div className="font-semibold text-accent">{field.value}</div>
                )}
              </div>
            ) : (
              <div className="font-semibold text-accent">{field.value}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
