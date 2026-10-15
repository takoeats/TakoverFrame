// Riven stat and weapon labels in the game language, keyed by the lowercased
// English label. English stays the key for grading, similarity and
// warframe.market, so the renderer swaps the text only where it shows it.

import { statTagToDisplayName } from "../config/shared/rivenStatDisplayNames";
import { TAG_TO_WFM_URL_NAME, wfmAttributeLabel } from "../config/shared/wfmRivenVocabulary";
import { normalizeErrorMessage } from "../config/shared/errors";
import { readPepDict, readPepExport } from "./bundledGameData";
import { DEFAULT_GAME_LOCALE, getGameLocale, localizeName } from "./gameLocale";
import { withScope } from "./logger";
import { localizedNameFields } from "./itemDatabase";
import { getAllRivenWeaponNames, getStatDisplayName, getWeaponUniqueName } from "./rivenData";

const log = withScope("rivenStatNames");

type RivenModExport = {
  upgradeEntries?: Array<{ tag?: unknown; upgradeValues?: Array<{ locTag?: unknown }> }>;
};

const cache = new Map<string, Record<string, string>>();

// The value placeholder sits wherever the language puts it ("|val|% Multishot",
// "|val|s Combo Duration" in English, after the name in Korean) and takes its
// unit along. Bow and heavy-attack qualifiers in parentheses are dropped.
export function cleanStatLabel(raw: string): string {
  return raw
    .replace(/\|[^|]*\|\S?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*[(（].*?[)）]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNames(): Record<string, string> {
  let mods: Record<string, RivenModExport> = {};
  let english: Readonly<Record<string, string>> = {};
  try {
    mods = (readPepExport("ExportUpgrades") ?? {}) as Record<string, RivenModExport>;
    english = readPepDict("en") ?? {};
  } catch (err) {
    log.warn("riven stat names unreadable:", normalizeErrorMessage(err));
  }

  const names: Record<string, string> = {};
  const add = (label: string, localized: string): void => {
    const key = label.toLowerCase();
    if (key && !(key in names)) names[key] = localized;
  };
  // warframe.market folds a few stat pairs into one attribute, so its label
  // gets the pair in the game language too.
  const bySlug = new Map<string, Set<string>>();

  for (const [key, mod] of Object.entries(mods)) {
    if (!key.includes("/Randomized/") || !Array.isArray(mod.upgradeEntries)) continue;
    const melee = key.includes("Melee");
    for (const entry of mod.upgradeEntries) {
      const tag = typeof entry.tag === "string" ? entry.tag : "";
      const locTag = entry.upgradeValues?.[0]?.locTag;
      if (!tag || typeof locTag !== "string") continue;
      const localized = cleanStatLabel(localizeName(locTag, ""));
      if (!localized) continue;
      // Both lookups hand back the bare tag for a stat they do not know.
      for (const label of [getStatDisplayName(tag, melee), statTagToDisplayName(tag, melee)]) {
        if (label !== tag) add(label, localized);
      }
      add(cleanStatLabel(english[locTag] ?? ""), localized);
      const slug = TAG_TO_WFM_URL_NAME[tag];
      if (slug) bySlug.set(slug, (bySlug.get(slug) ?? new Set()).add(localized));
    }
  }
  for (const [slug, labels] of bySlug) add(wfmAttributeLabel(slug), [...labels].join(" / "));
  return names;
}

/** Empty under English: every label already reads that way. */
export function getRivenStatNames(): Record<string, string> {
  const locale = getGameLocale();
  if (locale === DEFAULT_GAME_LOCALE) return {};
  let names = cache.get(locale);
  if (!names) {
    names = buildNames();
    cache.set(locale, names);
  }
  return names;
}

/** Empty under English. Not cached: the item database may still be loading on
 *  the first call, and a few hundred lookups cost nothing. */
export function getRivenWeaponLabels(): Record<string, string> {
  if (getGameLocale() === DEFAULT_GAME_LOCALE) return {};
  const labels: Record<string, string> = {};
  for (const name of getAllRivenWeaponNames()) {
    const { displayName } = localizedNameFields(getWeaponUniqueName(name), name);
    if (displayName) labels[name.toLowerCase()] = displayName;
  }
  return labels;
}
