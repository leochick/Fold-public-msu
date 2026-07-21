"use client";

/** Visual insert target between container cards while reordering (mirrors InsertionGap). */
export default function ContainerInsertGap({
  show,
  edge,
  active,
  onDragOver,
  onDrop,
}: {
  show: boolean;
  /** "before" sits on the leading edge; "after" on the trailing edge of the last card. */
  edge: "before" | "after";
  /** When false, ignore drag events so person drops still reach the container. */
  active: boolean;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!active || !onDragOver) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    onDragOver(event);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!active || !onDrop) return;
    event.preventDefault();
    event.stopPropagation();
    onDrop(event);
  }

  const lineClass = `rounded-full border-2 border-dashed border-accent/60 bg-accent/10 transition-opacity duration-150 ${
    show ? "opacity-100" : "opacity-0"
  }`;

  const beforeHorizontal = edge === "before" ? "-top-2" : "-bottom-2";
  const beforeVertical = edge === "before" ? "-left-2" : "-right-2";

  return (
    <>
      {/* Single-column: horizontal dashed bar */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`absolute left-0 right-0 z-20 h-4 flex items-center sm:hidden pointer-events-none ${
          active ? "!pointer-events-auto" : ""
        } ${beforeHorizontal}`}
        aria-hidden={!show}
      >
        <div className={`w-full h-1.5 ${lineClass}`} />
      </div>
      {/* Multi-column: vertical dashed bar */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`absolute top-0 bottom-0 z-20 w-4 hidden sm:flex items-stretch justify-center pointer-events-none ${
          active ? "!pointer-events-auto" : ""
        } ${beforeVertical}`}
        aria-hidden={!show}
      >
        <div className={`h-full w-1.5 ${lineClass}`} />
      </div>
    </>
  );
}
