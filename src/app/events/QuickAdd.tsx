"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BatchEventsReviewList, { type BatchEventItem } from "./BatchEventsReviewList";
import type { BatchEventIncoming } from "@/lib/contracts/events";

type Attendee = {
  match: "existing" | "new";
  studentId?: number;
  firstName?: string;
  lastName?: string;
  gender?: "M" | "F";
  year?: string;
  igHandle?: string;
  invitedById?: number;
  invitedByName?: string;
  _invitedByDisplayName?: string;
  notes?: string;
  rawText: string;
  _existingName?: string;
};

export interface RosterEntry {
  id: number;
  name: string;
}

type ParseResponse =
  | { mode: "single"; event: BatchEventItem; attendees: Attendee[] }
  | { mode: "batch"; intent: "create" | "update"; items: BatchEventItem[]; explanation: string };

export default function QuickAdd({ roster = [] }: { roster?: RosterEntry[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [intent, setIntent] = useState<"create" | "update">("create");
  const [batchItems, setBatchItems] = useState<BatchEventItem[]>([]);
  const [singleEvent, setSingleEvent] = useState<BatchEventItem | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [viewState, setViewState] = useState<"input" | "verify">("input");
  const [resultMode, setResultMode] = useState<"single" | "batch" | null>(null);

  const [isProcessing, startProcessingTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();

  function reset() {
    setText("");
    setError("");
    setExplanation("");
    setBatchItems([]);
    setSingleEvent(null);
    setAttendees([]);
    setViewState("input");
    setResultMode(null);
  }

  function handleProcessText() {
    if (!text.trim()) return;
    setError("");
    setExplanation("");

    startProcessingTransition(async () => {
      try {
        const r = await fetch("/api/parse-event-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Parse failed");

        const parsed = data as ParseResponse;
        if (parsed.mode === "batch") {
          setBatchItems(parsed.items);
          setExplanation(parsed.explanation);
          setIntent(parsed.intent ?? "create");
          setResultMode("batch");
        } else {
          setSingleEvent(parsed.event);
          setAttendees(parsed.attendees);
          setResultMode("single");
        }
        setViewState("verify");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleBatchActionToggle(index: number, action: "create" | "merge" | "skip") {
    setBatchItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, chosenAction: action } : item))
    );
  }

  function handleBatchTargetChange(index: number, existingId: number) {
    setBatchItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selectedExistingId: existingId } : item))
    );
  }

  function handleBatchIncomingChange(index: number, incoming: BatchEventIncoming) {
    setBatchItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, incoming } : item))
    );
  }

  function handleSingleEventAction(action: "create" | "merge" | "skip") {
    setSingleEvent((prev) => (prev ? { ...prev, chosenAction: action } : prev));
  }

  function handleSingleTargetChange(existingId: number) {
    setSingleEvent((prev) => (prev ? { ...prev, selectedExistingId: existingId } : prev));
  }

  function handleSingleIncomingChange(incoming: BatchEventIncoming) {
    setSingleEvent((prev) => (prev ? { ...prev, incoming } : prev));
  }

  function handleSaveCommit() {
    setError("");
    startSavingTransition(async () => {
      try {
        if (resultMode === "batch") {
          const r = await fetch("/api/commit-event-batch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mode: "batch",
              items: batchItems.map((x) => ({
                action: x.chosenAction,
                incoming: x.incoming,
                existingId: x.chosenAction === "merge" ? x.selectedExistingId : undefined,
              })),
            }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error ?? "Save failed");
          reset();
          router.push("/events");
          router.refresh();
          return;
        }

        if (!singleEvent) return;

        const r = await fetch("/api/commit-event-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "single",
            eventAction: singleEvent.chosenAction,
            event: singleEvent.incoming,
            existingEventId:
              singleEvent.chosenAction === "merge" ? singleEvent.selectedExistingId : undefined,
            attendees,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Save failed");

        reset();
        if (data.eventId) {
          router.push(`/events/${data.eventId}`);
        } else {
          router.push("/events");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const commitCount =
    resultMode === "batch"
      ? batchItems.filter((x) => x.chosenAction !== "skip").length
      : singleEvent?.chosenAction === "skip"
        ? 0
        : 1;

  return (
    <div className="card space-y-3 border-accent/30">
      <div>
        <h2 className="font-semibold">⚡ AI Quick Add Events</h2>
        <p className="text-xs text-black/60">
          Create events, add attendees, or apply bulk updates. Review merge targets and field changes before committing.
        </p>
      </div>

      {viewState === "input" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="input font-sans text-sm"
            placeholder={`e.g. "add Alex, Jordan to new Weekly 5/1 at Community Center"\n"create Weekly meetings 5/1, 5/8, 5/15 at Community Center"\n"Edit the Large Group events on 1/24, 2/5, and 3/16 to have type Large Group"\nOr paste Event + Notes columns from a spreadsheet to append dated notes`}
          />
          <button
            onClick={handleProcessText}
            disabled={isProcessing || !text.trim()}
            className="btn-primary"
          >
            {isProcessing ? "Analyzing content..." : "Process Text"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-black/5 dark:border-white/10">
          {resultMode === "batch" && (
            <BatchEventsReviewList
              items={batchItems}
              explanation={explanation}
              intent={intent}
              onActionToggle={handleBatchActionToggle}
              onTargetIdChange={handleBatchTargetChange}
              onIncomingChange={handleBatchIncomingChange}
              mergeButtonLabel="Update"
            />
          )}

          {resultMode === "single" && singleEvent && (
            <div className="space-y-4">
              <BatchEventsReviewList
                items={[singleEvent]}
                onActionToggle={(_, action) => handleSingleEventAction(action)}
                onTargetIdChange={(_, id) => handleSingleTargetChange(id)}
                onIncomingChange={(_, incoming) => handleSingleIncomingChange(incoming)}
                mergeButtonLabel="Merge"
              />

              <SingleAttendeesPreview
                attendees={attendees}
                roster={roster}
                onAttendeesChange={setAttendees}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setViewState("input")} disabled={isSaving} className="btn-ghost text-xs">
              Back
            </button>
            <button
              onClick={handleSaveCommit}
              disabled={isSaving || commitCount === 0}
              className="btn-primary text-xs"
            >
              {isSaving
                ? "Saving changes..."
                : resultMode === "single" && singleEvent?.chosenAction !== "skip"
                  ? `Create event + mark ${attendees.length} present`
                  : `Commit Event Changes (${commitCount})`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
    </div>
  );
}

function SingleAttendeesPreview({
  attendees,
  roster,
  onAttendeesChange,
}: {
  attendees: Attendee[];
  roster: RosterEntry[];
  onAttendeesChange: (at: Attendee[]) => void;
}) {
  const update = (i: number, patch: Partial<Attendee>) =>
    onAttendeesChange(attendees.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => onAttendeesChange(attendees.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="label">Attendees ({attendees.length})</div>
      {attendees.length === 0 && (
        <p className="text-sm text-black/50">No attendees found. The event will be created empty.</p>
      )}
      {attendees.map((p, i) => (
        <div key={i} className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`chip ${
                  p.match === "existing"
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-amber-500/15 text-amber-700"
                }`}
              >
                {p.match === "existing" ? "existing" : "new"}
              </span>
              <span className="font-medium">
                {p.match === "existing"
                  ? p._existingName ?? `Student #${p.studentId}`
                  : `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || (
                      <em className="text-black/40">unnamed</em>
                    )}
              </span>
            </div>
            <button onClick={() => remove(i)} className="text-xs text-black/40 hover:text-red-600">
              drop
            </button>
          </div>
          {p.match === "new" && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  className="input"
                  placeholder="First"
                  value={p.firstName ?? ""}
                  onChange={(e) => update(i, { firstName: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Last"
                  value={p.lastName ?? ""}
                  onChange={(e) => update(i, { lastName: e.target.value })}
                />
                <select
                  className="input"
                  value={p.year ?? ""}
                  onChange={(e) => update(i, { year: e.target.value || undefined })}
                >
                  <option value="">year —</option>
                  {["freshman", "sophomore", "junior", "senior", "grad", "other"].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={p.gender ?? ""}
                  onChange={(e) =>
                    update(i, { gender: (e.target.value || undefined) as "M" | "F" | undefined })
                  }
                >
                  <option value="">gender —</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
                <input
                  className="input"
                  placeholder="@ig"
                  value={p.igHandle ?? ""}
                  onChange={(e) => update(i, { igHandle: e.target.value.replace(/^@/, "") })}
                />
              </div>
              <InvitedByPicker attendee={p} roster={roster} onChange={(patch) => update(i, patch)} />
            </div>
          )}
          <p className="text-[11px] text-black/30">from: &quot;{p.rawText}&quot;</p>
        </div>
      ))}
    </div>
  );
}

function InvitedByPicker({
  attendee,
  roster,
  onChange,
}: {
  attendee: Attendee;
  roster: RosterEntry[];
  onChange: (patch: Partial<Attendee>) => void;
}) {
  const [text, setText] = useState(attendee._invitedByDisplayName ?? attendee.invitedByName ?? "");
  const datalistId = `roster-${attendee.studentId ?? attendee.firstName ?? Math.random()}`;

  const handle = (val: string) => {
    setText(val);
    const t = val.trim().toLowerCase();
    if (!t) {
      onChange({ invitedById: undefined, invitedByName: undefined, _invitedByDisplayName: undefined });
      return;
    }
    const match = roster.find((r) => r.name.toLowerCase() === t);
    if (match) {
      onChange({
        invitedById: match.id,
        invitedByName: match.name,
        _invitedByDisplayName: match.name,
      });
    } else {
      onChange({
        invitedById: undefined,
        invitedByName: val.trim(),
        _invitedByDisplayName: undefined,
      });
    }
  };

  const isResolved = !!attendee.invitedById;
  const hasText = !!text.trim();

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="label !text-[10px]">Invited by</span>
      <input
        className="input flex-1 max-w-xs text-xs"
        placeholder="(optional) inviter's name"
        list={datalistId}
        value={text}
        onChange={(e) => handle(e.target.value)}
      />
      <datalist id={datalistId}>
        {roster.map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
      {isResolved && (
        <span className="chip bg-emerald-500/15 text-emerald-700">resolved → #{attendee.invitedById}</span>
      )}
      {!isResolved && hasText && (
        <span className="chip bg-amber-500/15 text-amber-700">unresolved</span>
      )}
    </div>
  );
}
