export function isDragLeave(
  currentTarget: EventTarget & Element,
  relatedTarget: EventTarget | null
) {
  if (!relatedTarget || !(relatedTarget instanceof Node)) return true;
  return !currentTarget.contains(relatedTarget);
}
