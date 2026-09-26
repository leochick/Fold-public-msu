import type { DragEvent } from "react";

export type RegularsDragSource = "unassigned" | "container";

export type RegularsDragMeta = {
  id: number;
  source: RegularsDragSource;
  containerIndex?: number;
};

const MIME = "application/x-regulars-event-drag";
const TEXT_PREFIX = "regulars-event:";

export function setRegularsDragData(event: DragEvent, meta: RegularsDragMeta) {
  const containerIndex = meta.containerIndex ?? "";
  event.dataTransfer.setData(
    "text/plain",
    `${TEXT_PREFIX}${meta.id}:${meta.source}:${containerIndex}`
  );
  try {
    event.dataTransfer.setData(MIME, JSON.stringify(meta));
  } catch {
    // Some browsers reject custom types; text/plain is enough.
  }
  event.dataTransfer.effectAllowed = "move";
}

export function readRegularsDragData(event: DragEvent): RegularsDragMeta | null {
  const raw = event.dataTransfer.getData(MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RegularsDragMeta;
      if (Number.isFinite(parsed.id)) return parsed;
    } catch {
      // fall through
    }
  }

  const plain = event.dataTransfer.getData("text/plain");
  if (!plain.startsWith(TEXT_PREFIX)) return null;
  const [idRaw, source, containerRaw] = plain.slice(TEXT_PREFIX.length).split(":");
  const id = Number(idRaw);
  if (!Number.isFinite(id)) return null;
  const containerIndex = containerRaw === "" || containerRaw == null ? undefined : Number(containerRaw);
  return {
    id,
    source: source === "container" ? "container" : "unassigned",
    containerIndex: Number.isFinite(containerIndex) ? containerIndex : undefined,
  };
}
