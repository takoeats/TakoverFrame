// The planner sends its squad size alone ({ squadSize }) at startup and on every
// change, so the relic overlay follows it without "Push to Overlay". That push
// must not count as pushed filters: those replace the overlay's own sorting.

/** The squad size of a squad-only push, null for anything else. */
export function squadOnlyPush(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== "squadSize") return null;
  const size = (raw as { squadSize: unknown }).squadSize;
  return typeof size === "number" && Number.isInteger(size) && size >= 1 && size <= 4 ? size : null;
}
