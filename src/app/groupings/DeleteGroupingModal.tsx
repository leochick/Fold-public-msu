"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGroupingAction } from "../groupings-actions";

export default function DeleteGroupingModal({
  groupingId,
  groupingName,
  isActive,
  onClose,
}: {
  groupingId: number;
  groupingName: string;
  isActive: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      await deleteGroupingAction(groupingId);
      onClose();
      if (isActive) {
        router.push("/groupings");
      }
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-xl">
        <h2 className="text-lg font-semibold">Delete grouping</h2>
        <p className="text-sm text-black/60 dark:text-white/60 mt-2">
          Delete <span className="font-medium text-black dark:text-white">{groupingName}</span>?
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-black/5 dark:border-white/10">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary bg-red-600 hover:opacity-90 text-white border-red-600"
            onClick={confirmDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
