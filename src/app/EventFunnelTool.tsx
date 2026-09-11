"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { EventFunnelPayload, EventFunnelSource } from "@/lib/event-funnel";

const CURRENT_COLORS = ["#2a78d6", "#eb6834", "#eda100", "#4a3aa7", "#0ea5e9", "#c026d3"];
const NEW_STUDENTS_COLOR = "#1baf7a";
const RETURNING_COLOR = "#64748b";
const DEST_COLOR = "#7c3aed";

function sourceColor(source: EventFunnelSource, currentIndex: number): string {
  if (source.newStudents) return NEW_STUDENTS_COLOR;
  if (source.returning) return RETURNING_COLOR;
  return CURRENT_COLORS[currentIndex % CURRENT_COLORS.length];
}

function truncateLabel(label: string, max = 34): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function ribbonPath(
  sx: number,
  sy0: number,
  sy1: number,
  tx: number,
  ty0: number,
  ty1: number
): string {
  const mx = (sx + tx) / 2;
  return `M${sx},${sy0} C${mx},${sy0} ${mx},${ty0} ${tx},${ty0} L${tx},${ty1} C${mx},${ty1} ${mx},${sy1} ${sx},${sy1} Z`;
}

function FlowCount({ x, y, value }: { x: number; y: number; value: number }) {
  const label = String(value);
  const bw = 10 + label.length * 7.2;
  return (
    <g>
      <rect
        x={x - bw / 2}
        y={y - 9}
        width={bw}
        height={18}
        rx={5}
        className="fill-white dark:fill-ink"
        stroke="rgba(0,0,0,0.08)"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="fill-ink dark:fill-paper"
        fontSize="12"
        fontWeight="600"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>
    </g>
  );
}

function EventFunnelSankey({
  sources,
  destLabel,
  destCount,
}: {
  sources: EventFunnelSource[];
  destLabel: string;
  destCount: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const colored = useMemo(() => {
    let currentIndex = 0;
    return sources.map((source) => {
      const color = sourceColor(source, currentIndex);
      if (!source.returning && !source.newStudents) currentIndex += 1;
      return { ...source, color };
    });
  }, [sources]);

  const hovered = colored.find((source) => source.key === hoveredKey) ?? null;

  function onStreamMove(event: MouseEvent<SVGGElement>, key: string) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredKey(key);
    const x = Math.min(Math.max(event.clientX - rect.left + 14, 8), Math.max(8, rect.width - 268));
    const y = Math.min(Math.max(event.clientY - rect.top + 14, 8), Math.max(8, rect.height - 16));
    setTooltip({ x, y });
  }

  function clearHover() {
    setHoveredKey(null);
    setTooltip(null);
  }

  const W = 1000;
  const left = 250;
  const right = 790;
  const nodeW = 16;
  const top = 24;
  const bottomPad = 24;
  const gap = 12;
  const minH = 260;
  const minNodeH = 28;
  const total = destCount;
  const n = colored.length;
  const minInner = n * minNodeH + gap * Math.max(0, n - 1);
  const inner = Math.max(minH - top - bottomPad, minInner);
  const scale = (inner - gap * Math.max(0, n - 1)) / Math.max(total, 1);

  type LaidOut = (typeof colored)[number] & { y0: number; y1: number; h: number };
  let y = top;
  const leftNodes: LaidOut[] = colored.map((source) => {
    const h = Math.max(source.count * scale, minNodeH);
    const node = { ...source, y0: y, y1: y + h, h };
    y += h + gap;
    return node;
  });

  const leftStackHeight = leftNodes.length
    ? leftNodes[leftNodes.length - 1].y1 - leftNodes[0].y0
    : destCount * scale;
  const H = top + leftStackHeight + bottomPad;
  const rightH = Math.max(leftStackHeight, 8);
  const rightY0 = leftNodes[0]?.y0 ?? top;
  const rightNode = { x: right, y0: rightY0, y1: rightY0 + rightH, h: rightH };

  let leftCursor = leftNodes[0]?.y0 ?? top;
  let rightCursor = rightY0;
  const flows = leftNodes.map((source) => {
    const sh = source.h;
    const th = destCount > 0 ? (source.count / destCount) * rightH : 0;
    const flow = {
      ...source,
      sy0: leftCursor,
      sy1: leftCursor + sh,
      ty0: rightCursor,
      ty1: rightCursor + th,
    };
    leftCursor += sh + gap;
    rightCursor += th;
    return flow;
  });

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={clearHover}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="group"
        aria-label={`First events for ${destCount} students at ${destLabel}`}
      >
        <defs>
          <filter id="event-funnel-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#111827" floodOpacity="0.28" />
          </filter>
        </defs>

        <rect x={right} y={rightNode.y0} width={nodeW} height={rightNode.h} rx="2" fill={DEST_COLOR} />
        <text
          x={right + nodeW + 10}
          y={(rightNode.y0 + rightNode.y1) / 2 - 5}
          className="fill-ink dark:fill-paper"
          fontSize="13"
          fontWeight="600"
        >
          {truncateLabel(destLabel, 28)}
        </text>
        <text
          x={right + nodeW + 10}
          y={(rightNode.y0 + rightNode.y1) / 2 + 11}
          className="fill-black/50 dark:fill-white/50"
          fontSize="12"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {destCount}
        </text>

        {flows.map((flow) => {
          const mid = (flow.y0 + flow.y1) / 2;
          const active = hoveredKey === flow.key;
          const dimmed = hoveredKey != null && !active;
          const baseOpacity = flow.returning ? 0.38 : 0.5;
          return (
            <g
              key={flow.key}
              className="cursor-pointer"
              opacity={dimmed ? 0.16 : 1}
              filter={active ? "url(#event-funnel-glow)" : undefined}
              onMouseEnter={(event) => onStreamMove(event, flow.key)}
              onMouseMove={(event) => onStreamMove(event, flow.key)}
              aria-label={`${flow.label}: ${flow.students.map((student) => student.name).join(", ")}`}
            >
              <rect
                x={8}
                y={flow.y0 - 4}
                width={left + nodeW - 8}
                height={flow.h + 8}
                fill="transparent"
              />
              <path
                d={ribbonPath(left + nodeW, flow.sy0, flow.sy1, right, flow.ty0, flow.ty1)}
                fill={flow.color}
                opacity={active ? 0.92 : baseOpacity}
              />
              <rect
                x={left}
                y={flow.y0}
                width={nodeW}
                height={flow.h}
                rx="2"
                fill={flow.color}
                stroke={active ? "#111827" : "transparent"}
                strokeWidth={active ? 2 : 0}
              />
              <rect
                x={right}
                y={flow.ty0}
                width={nodeW}
                height={Math.max(flow.ty1 - flow.ty0, 2)}
                rx="2"
                fill={active ? flow.color : DEST_COLOR}
                opacity={active ? 1 : 0}
                stroke={active ? "#111827" : "transparent"}
                strokeWidth={active ? 2 : 0}
              />
              <text
                x={left - 10}
                y={mid - 5}
                textAnchor="end"
                className="fill-ink dark:fill-paper"
                fontSize="13"
                fontWeight={active ? 700 : 600}
              >
                {truncateLabel(flow.label)}
              </text>
              <text
                x={left - 10}
                y={mid + 11}
                textAnchor="end"
                className="fill-black/50 dark:fill-white/50"
                fontSize="12"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {flow.count}
              </text>
              {flow.count > 0 && (
                <FlowCount
                  x={(left + nodeW + right) / 2}
                  y={(flow.sy0 + flow.sy1 + flow.ty0 + flow.ty1) / 4}
                  value={flow.count}
                />
              )}
            </g>
          );
        })}
      </svg>

      {hovered && tooltip && (
        <div
          className="absolute z-20 w-64 max-h-72 overflow-y-auto rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-ink px-3 py-2.5 shadow-md pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          <div className="font-semibold text-sm">{hovered.label}</div>
          <div className="text-[11px] text-black/50 dark:text-white/50 mb-1.5">
            {hovered.count} {hovered.count === 1 ? "student" : "students"}
          </div>
          <ul className="space-y-0.5 text-xs">
            {hovered.students.map((student) => (
              <li key={student.id}>{student.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function EventFunnelTool({ payload }: { payload: EventFunnelPayload }) {
  const defaultEventId = payload.events.at(-1)?.id ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(defaultEventId);

  useEffect(() => {
    if (selectedId != null && payload.events.some((event) => event.id === selectedId)) return;
    setSelectedId(payload.events.at(-1)?.id ?? null);
  }, [payload.events, selectedId]);

  const selected = payload.events.find((event) => event.id === selectedId) ?? null;
  const breakdown = selected ? payload.byEventId[String(selected.id)] : undefined;
  const sources = breakdown?.sources ?? [];
  const total = breakdown?.total ?? 0;
  const returningCount = sources.filter((s) => s.returning).reduce((sum, s) => sum + s.count, 0);
  const newCount = total - returningCount;

  return (
    <div className="card lg:col-span-2 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold">Event Funnel Tool</h3>
          <p className="text-xs text-black/50 dark:text-white/50 mt-1 max-w-2xl">
            Of the students who attended the selected event, ribbons show the first event each
            person came from. Previous-semester sources share one color — those are returning
            students.
          </p>
        </div>
        <label className="sm:w-80 shrink-0">
          <span className="label block mb-1">Event</span>
          <select
            className="input"
            value={selectedId ?? ""}
            onChange={(event) => setSelectedId(event.target.value ? Number(event.target.value) : null)}
            disabled={payload.events.length === 0}
          >
            {payload.events.length === 0 ? (
              <option value="">No events this semester</option>
            ) : (
              payload.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {event.dateLabel}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {payload.events.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-black/40">
          no events in this semester yet
        </div>
      ) : total === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-black/40">
          no attendance recorded for this event
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60 dark:text-white/60">
            <span>
              <span className="font-semibold tabular-nums text-ink dark:text-paper">{total}</span>{" "}
              attended
            </span>
            <span>
              <span className="font-semibold tabular-nums text-ink dark:text-paper">{newCount}</span>{" "}
              first event this semester
            </span>
            <span>
              <span className="font-semibold tabular-nums text-ink dark:text-paper">{returningCount}</span>{" "}
              returning
            </span>
          </div>

          <EventFunnelSankey
            sources={sources}
            destLabel={selected?.name ?? "Event"}
            destCount={total}
          />

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-black/60 dark:text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: NEW_STUDENTS_COLOR }} />
              New Students
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DEST_COLOR }} />
              Selected event
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: RETURNING_COLOR }} />
              Returning students (previous semester)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
