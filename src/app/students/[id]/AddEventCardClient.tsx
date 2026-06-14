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
  const [selectedEventId, setSelectedEventId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSaveLink = async () => {
    if (!selectedEventId) return;
    setError("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/students/link-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            eventId: Number(selectedEventId),
          }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed linking event.");
        }

        setSelectedEventId("");
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Network execution error.");
      }
    });
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">⚡ Link to Past Event</h2>
        <p className="text-xs text-black/60">
          Manually add this student to an existing event attendance roster.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="w-full space-y-1">
          <label className="label" htmlFor="link-event-select">Select Event</label>
          <select
            id="link-event-select"
            className="input bg-transparent"
            value={selectedEventId}
            disabled={isPending || unassignedEvents.length === 0}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {unassignedEvents.length === 0 ? (
              <option value="">No unassigned events available</option>
            ) : (
              <>
                <option value="">— Choose an event —</option>
                {unassignedEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({new Date(e.date).toLocaleDateString("en-US", { timeZone: "UTC" })})
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        
        <button
          onClick={handleSaveLink}
          disabled={isPending || !selectedEventId}
          className="btn-primary w-full sm:w-auto shrink-0"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
