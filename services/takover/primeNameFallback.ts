// A prime that only @wfcd/items knows has no DE language key until the export
// catches up, so it would stay English in every other client language. Its name
// is composed from the base item's name and the suffix other primes localize the
// same English suffix to ("<Base> Prime Chassis Blueprint").

import { DEFAULT_GAME_LOCALE, getGameLocale, localizeName } from "../gameLocale";

type NamedItem = { name: string; nameKey?: string | null };

const PRIME_NAME = /^(.+?)( Prime(?: .+)?)$/;
// Same key and English fallback itemDatabase composes recipe names with.
const BLUEPRINT_PATTERN_KEY = "/Lotus/Language/Items/BlueprintAndItem";
const BLUEPRINT_PATTERN_EN = "|ITEM| Blueprint";
const BLUEPRINT_SUFFIX = " Blueprint";

type Composer = (english: string) => string | null;

const composers = new WeakMap<object, Map<string, Composer>>();

function buildComposer(items: Iterable<NamedItem>): Composer {
  const keyed: Array<{ english: string; localized: string }> = [];
  const baseNames = new Map<string, string>();
  for (const item of items) {
    if (!item.nameKey) continue;
    const localized = localizeName(item.nameKey, item.name);
    if (localized === item.name) continue;
    keyed.push({ english: item.name, localized });
    if (!baseNames.has(item.name)) baseNames.set(item.name, localized);
  }

  // Majority vote per English suffix, so one oddly named prime cannot set it.
  const votes = new Map<string, Map<string, number>>();
  for (const { english, localized } of keyed) {
    const match = PRIME_NAME.exec(english);
    const base = match && baseNames.get(match[1]);
    if (!match || !base || !localized.startsWith(base)) continue;
    const tally = votes.get(match[2]) ?? new Map<string, number>();
    const suffix = localized.slice(base.length);
    tally.set(suffix, (tally.get(suffix) ?? 0) + 1);
    votes.set(match[2], tally);
  }
  const suffixes = new Map<string, string>();
  for (const [english, tally] of votes) {
    const [winner] = [...tally].sort((a, b) => b[1] - a[1])[0];
    suffixes.set(english, winner);
  }

  const compose: Composer = (english) => {
    const match = PRIME_NAME.exec(english);
    if (!match) return null;
    const base = baseNames.get(match[1]);
    const suffix = suffixes.get(match[2]);
    if (base && suffix) return base + suffix;
    // Main blueprints carry no key of their own, so no prime votes for their suffix.
    if (!english.endsWith(BLUEPRINT_SUFFIX)) return null;
    const result = compose(english.slice(0, -BLUEPRINT_SUFFIX.length));
    return result
      ? localizeName(BLUEPRINT_PATTERN_KEY, BLUEPRINT_PATTERN_EN).replace("|ITEM|", result)
      : null;
  };
  return compose;
}

/**
 * Localized name for a keyless prime, or null when it cannot be composed.
 * `items` is the item table; one composer is built per table and locale.
 */
export function composeKeylessPrimeName(
  items: Record<string, NamedItem>,
  english: string,
): string | null {
  const locale = getGameLocale();
  if (locale === DEFAULT_GAME_LOCALE) return null;
  let byLocale = composers.get(items);
  if (!byLocale) {
    byLocale = new Map();
    composers.set(items, byLocale);
  }
  let compose = byLocale.get(locale);
  if (!compose) {
    compose = buildComposer(Object.values(items));
    byLocale.set(locale, compose);
  }
  return compose(english);
}
