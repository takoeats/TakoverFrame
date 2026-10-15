// The rank table the renderer bundles carries English names only. DE's own
// export holds the name keys, so the game language reaches the Syndicates tab
// without anyone translating syndicates or rank titles by hand.

import type { SyndicateNames } from "../config/shared/syndicateTypes";
import { normalizeErrorMessage } from "../config/shared/errors";
import { readPepExport } from "./bundledGameData";
import { DEFAULT_GAME_LOCALE, getGameLocale } from "./gameLocale";
import { withScope } from "./logger";
import { localizedDictValue } from "./regionNames";

const log = withScope("syndicateNames");

type ExportSyndicate = { name?: unknown; titles?: Array<{ level?: unknown; name?: unknown }> };

const cache = new Map<string, SyndicateNames>();

function buildNames(): SyndicateNames {
  let table: Record<string, ExportSyndicate> = {};
  try {
    table = (readPepExport("ExportSyndicates") ?? {}) as Record<string, ExportSyndicate>;
  } catch (err) {
    log.warn("ExportSyndicates unreadable:", normalizeErrorMessage(err));
  }
  const names: SyndicateNames = {};
  for (const [tag, entry] of Object.entries(table)) {
    const name = localizedDictValue(entry.name);
    if (!name) continue;
    const titles: Record<string, string> = {};
    for (const title of entry.titles ?? []) {
      const label = localizedDictValue(title.name);
      if (label && typeof title.level === "number") titles[String(title.level)] = label;
    }
    names[tag] = { name, titles };
  }
  return names;
}

/** Empty under English: the bundled table already reads that way. */
export function getSyndicateNames(): SyndicateNames {
  const locale = getGameLocale();
  if (locale === DEFAULT_GAME_LOCALE) return {};
  let names = cache.get(locale);
  if (!names) {
    names = buildNames();
    cache.set(locale, names);
  }
  return names;
}
