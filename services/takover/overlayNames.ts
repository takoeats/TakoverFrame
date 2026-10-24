// Game-language names for the reward and planner overlays. `name` stays English
// because prices, ownership and the layout editor join on it; the overlay shows
// `displayName` when the game language moved the name.

import { hasQuantityPrefix, stripQuantityPrefix } from "../../config/shared/quantityPrefix";
import { localizedNameFields } from "../itemDatabase";

/** displayName for a reward, keeping a bonus count ("2X ") the item name lacks. */
export function rewardDisplayName(
  uniqueName: string | null | undefined,
  english: string,
): { displayName?: string } {
  const bare = stripQuantityPrefix(english);
  const { displayName } = localizedNameFields(uniqueName, bare);
  if (!displayName) return {};
  const count = hasQuantityPrefix(english) ? english.slice(0, english.length - bare.length) : "";
  return { displayName: count + displayName };
}

/**
 * displayName for a set part chip: the part alone, as the English chip says
 * "Chassis" rather than the full name, so the set's own name is cut off the front.
 */
export function partDisplayName(
  setUniqueName: string | null | undefined,
  setName: string,
  partUniqueName: string | null | undefined,
  partName: string,
): { displayName?: string } {
  const part = localizedNameFields(partUniqueName, partName).displayName;
  if (!part) return {};
  const set = localizedNameFields(setUniqueName, setName).displayName;
  const short = set && part.startsWith(`${set} `) ? part.slice(set.length + 1) : part;
  return short ? { displayName: short } : {};
}
