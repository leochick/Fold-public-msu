"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/funnel/types";

interface AttemptRow {
  id: number;
  channel: Channel;
  channelDetail: string | null;
  attemptedAt: string;
  responded: boolean;
  notes: string | null;
  attemptedByDisplayName?: string;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  ig_dm: "IG DM",
  text: "Text",
  phone: "Phone",
  email: "Email",
  in_person: "In person",
  other: "Other",
};

export default function ContactLog({
  studentId,
  attempts,
}: {
  studentId: number;
  attempts: AttemptRow[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("ig_dm");
  const [detail, setDetail] = useState("");
  const [responded, setResponded] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [logging, startLog] = useTransition();

  const log = () => {
    setError("");
    startLog(async () => {
      try {
        const r = await fetch("/api/contacts/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            studentId,
            channel,
            channelDetail: detail || undefined,
            responded,
            notes: notes || undefined,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Save failed");
        setDetail("");
        setNotes("");
        setResponded(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold">Contact log</h2>

      <div className="space-y-1">
        {attempts.length === 0 && (
          <p className="text-sm text-black/50">No contact attempts logged yet.</p>
        )}
        {attempts.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between text-sm border-t border-black/5 dark:border-white/5 pt-1 first:border-t-0 first:pt-0"
          >
            <div className="flex items-center gap-2">
              <span className="chip">{CHANNEL_LABEL[a.channel]}</span>
              <span>
                {a.attemptedByDisplayName ?? "?"}{" "}
                {a.responded ? (
                  <span className="text-emerald-600">→ responded</span>
                ) : (
                  <span className="text-black/50">→ no reply</span>
                )}
              </span>
              {a.channelDetail && (
                <span className="text-xs text-black/60 italic">{a.channelDetail}</span>
              )}
            </div>
            <span className="text-xs text-black/50">
              {new Date(a.attemptedAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-black/5 dark:border-white/10 pt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          className="input"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
        >
          {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          className="input md:col-span-2"
          placeholder="Detail (e.g. handle texted)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
        <input
          className="input md:col-span-3"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={responded}
            onChange={(e) => setResponded(e.target.checked)}
          />
          Responded
        </label>
        <button className="btn-primary" onClick={log} disabled={logging}>
          {logging ? "Logging…" : "Log attempt"}
        </button>
        {error && <div className="text-xs text-red-600 md:col-span-3">{error}</div>}
      </div>
    </div>
  );
}
