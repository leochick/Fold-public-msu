"use client";

import { useState } from "react";
import type { Staff, StaffChild } from "../../../../drizzle/schema";
import { formatDateInput } from "@/lib/parse-student";

export type StaffOption = { id: number; name: string };

type ChildDraft = {
  key: string;
  name: string;
  age: string;
  gender: "" | "M" | "F";
};

function toDrafts(children: StaffChild[] | null | undefined): ChildDraft[] {
  if (!children?.length) return [];
  return children.map((child, index) => ({
    key: `existing-${index}`,
    name: child.name ?? "",
    age: child.age != null ? String(child.age) : "",
    gender: child.gender === "M" || child.gender === "F" ? child.gender : "",
  }));
}

let draftKey = 0;
function nextKey() {
  draftKey += 1;
  return `new-${draftKey}`;
}

export default function StaffForm({
  action,
  staff,
  staffOptions = [],
}: {
  action: (fd: FormData) => Promise<void>;
  staff?: Staff;
  staffOptions?: StaffOption[];
}) {
  const s = staff ?? ({} as Partial<Staff>);
  const spouseOptions: [string, string][] = [
    ["", "—"],
    ...staffOptions
      .filter((o) => o.id !== s.id)
      .map((o) => [String(o.id), o.name] as [string, string]),
  ];
  const [children, setChildren] = useState<ChildDraft[]>(() => toDrafts(s.children));

  function addChild() {
    setChildren((prev) => [...prev, { key: nextKey(), name: "", age: "", gender: "" }]);
  }

  function updateChild(key: string, patch: Partial<Omit<ChildDraft, "key">>) {
    setChildren((prev) => prev.map((child) => (child.key === key ? { ...child, ...patch } : child)));
  }

  function removeChild(key: string) {
    setChildren((prev) => prev.filter((child) => child.key !== key));
  }

  return (
    <form action={action} className="card space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="firstName" defaultValue={s.firstName ?? ""} required />
        <Field label="Last name" name="lastName" defaultValue={s.lastName ?? ""} />
      </div>
      <Select
        label="Gender"
        name="gender"
        defaultValue={s.gender ?? ""}
        options={[["", "—"], ["M", "Male"], ["F", "Female"]]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Starting Date"
          name="startingDate"
          type="date"
          defaultValue={formatDateInput(s.startingDate)}
        />
        <Field
          label="Ending Date"
          name="endingDate"
          type="date"
          defaultValue={formatDateInput(s.endingDate)}
        />
      </div>
      <Select
        label="Spouse"
        name="spouseId"
        defaultValue={s.spouseId != null ? String(s.spouseId) : ""}
        options={spouseOptions}
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="label">Children</span>
          <button type="button" className="btn-ghost text-sm" onClick={addChild}>
            + Add child
          </button>
        </div>
        {children.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No children listed.</p>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.key}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_7rem_auto] sm:items-end"
              >
                <label className="block space-y-1 min-w-0">
                  <span className="label">Name</span>
                  <input
                    className="input"
                    name="childName"
                    value={child.name}
                    onChange={(event) => updateChild(child.key, { name: event.target.value })}
                    placeholder="Name"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="label">Age</span>
                  <input
                    className="input"
                    name="childAge"
                    type="number"
                    min={0}
                    step={1}
                    value={child.age}
                    onChange={(event) => updateChild(child.key, { age: event.target.value })}
                    placeholder="Age"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="label">Gender</span>
                  <select
                    className="input"
                    name="childGender"
                    value={child.gender}
                    onChange={(event) =>
                      updateChild(child.key, {
                        gender: event.target.value === "M" || event.target.value === "F" ? event.target.value : "",
                      })
                    }
                  >
                    <option value="">—</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-ghost mb-0.5 px-2 text-sm text-black/55 dark:text-white/55"
                  onClick={() => removeChild(child.key)}
                  aria-label={`Remove ${child.name || "child"}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" type="submit">Save</button>
      </div>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <input className="input" {...rest} />
    </label>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: [string, string][];
}) {
  return (
    <label className="block space-y-1">
      <span className="label">{label}</span>
      <select name={name} defaultValue={defaultValue} className="input">
        {options.map(([v, l]) => (
          <option key={v || "__empty"} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
