"use client";

import { useState } from "react";
import { contrastingTextColor } from "@/lib/role-boards";

export type StaffRoleOption = {
  displayName: string;
  color: string;
  responsibilities: string[];
};

export default function AssociateRoleModal({
  staffName,
  roles,
  currentRoleName,
  onConfirm,
  onClose,
}: {
  staffName: string;
  roles: StaffRoleOption[];
  currentRoleName?: string;
  onConfirm: (roleName: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentRoleName ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-xl">
        <h2 className="text-lg font-semibold">Associate with role</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mt-2">
          Choose a role for{" "}
          <span className="font-medium text-black dark:text-white">{staffName}</span> in this
          container.
        </p>

        <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
          {roles.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50 py-4 text-center">
              This staff member has no roles on the role board for this view.
            </p>
          ) : (
            roles.map((role) => {
              const isSelected = selected === role.displayName;
              return (
                <button
                  key={role.displayName}
                  type="button"
                  onClick={() => setSelected(role.displayName)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-black/10 dark:border-white/15 hover:border-black/25 dark:hover:border-white/30"
                  }`}
                >
                  <span
                    className="inline-block rounded px-2 py-0.5 text-sm font-medium"
                    style={{
                      backgroundColor: role.color,
                      color: contrastingTextColor(role.color),
                    }}
                  >
                    {role.displayName}
                  </span>
                  {role.responsibilities.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-black/55 dark:text-white/55">
                      {role.responsibilities.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-black/5 dark:border-white/10">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onConfirm(selected);
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
