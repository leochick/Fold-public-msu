"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface DropdownEvent {
  id: number;
  name: string;
  date: Date;
}

export default function AddEventCardClient({
  studentId,
  unassignedEvents,
}: {
  studentId: number;
  unassignedEvents: DropdownEvent[];
}) {
  const router = useRouter();
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [isSaving, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleToggleCheckbox = (eventId: number) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSaveBatchLinks = async () => {
    if (selectedEventIds.length === 0) return;
    setError("");

    startTransition(async () => {
      try {
        // Pointing EXACTLY to the new path to avoid the 404 HTML payload mismatch!
        const res = await fetch("/api/students/commit-batch-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            eventIds: selectedEventIds,
          }),
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed linking selected events.");
        }

        setSelectedEventIds([]);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Network transaction failure.");
      }
    });
  };

  return (
    <div className="card space-y-4 border-accent/20">
      <div>
        <h2 className="font-semibold">⚡ Link to Past Events</h2>
        <p className="text-xs text-black/60">
          Select all existing events this student attended to update their status in bulk.
        </p>
      </div>

      {unassignedEvents.length === 0 ? (
        <p className="text-sm text-black/40 italic">No remaining unassigned events available.</p>
      ) : (
        <div className="space-y-3">
          {/* Scrollable multi-select panel matching Fold's native layout system */}
          <div className="overflow-y-auto max-h-48 border border-black/10 dark:border-white/10 rounded-lg p-2 space-y-1 bg-black/5 dark:bg-black/20">
            {unassignedEvents.map((e) => (
              <label 
                key={e.id} 
                className="flex items-center gap-3 p-2 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-accent"
                  checked={selectedEventIds.includes(e.id)}
                  disabled={isSaving}
                  onChange={() => handleToggleCheckbox(e.id)}
                />
                <span className="flex-1 truncate">
                  {e.name}{" "}
                  <span className="text-xs text-black/40 dark:text-white/40 ml-1">
                    ({new Date(e.date).toLocaleDateString("en-US", { timeZone: "UTC" })})
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-black/50">
              {selectedEventIds.length} event(s) selected
            </span>
            <button
              onClick={handleSaveBatchLinks}
              disabled={isSaving || selectedEventIds.length === 0}
              className="btn-primary py-1.5 text-xs"
            >
              {isSaving ? "Linking records..." : "Save Selection"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
