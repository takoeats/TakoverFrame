import type { ItemDbEntry } from "../types/inventory.js";
import type { WfmItemsLookup } from "../types/ipc.js";

// `name` is English and stays the join key for warframe.market, OCR and every
// by-name lookup. `displayName` exists only when the active game language moved
// it, so every user-facing label reads through here and nothing else.
export function itemLabel(
  item: { name?: string | null; displayName?: string | null } | null | undefined,
): string {
  if (!item) return "";
  return item.displayName || item.name || "";
}

// warframe.market names are English only. Its gameRef leads back to the item
// database, whose displayName is absent when the game language has no name for
// the item yet, so the market's own English name stays the fallback.
export function marketItemLabel(
  englishName: string | null | undefined,
  wfm: WfmItemsLookup,
  db: Readonly<Record<string, ItemDbEntry>>,
): string {
  if (!englishName) return "";
  const ref = wfm[englishName.toLowerCase()]?.gameRef;
  return (ref && db[ref]?.displayName) || englishName;
}
