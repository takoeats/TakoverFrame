// Korean-client glue for the relic reward scan: which on-screen names each reward
// can have, and the index cached per reward list.

import { getGameLocale, localizeName } from "../gameLocale";
import { localizedNameFields } from "../itemDatabase";
import type { SortedItem } from "../rewardScannerMatch";
import {
  buildKoRewardIndex,
  rankKoRewardCandidates,
  type KoRewardCandidate,
  type KoRewardIndex,
} from "./koRewardMatcher";

// Same key and English fallback itemDatabase composes recipe names with.
const BLUEPRINT_PATTERN_KEY = "/Lotus/Language/Items/BlueprintAndItem";
const BLUEPRINT_PATTERN_EN = "|ITEM| Blueprint";
const QUANTITY_PREFIX_RE = /^(\d+)X\s+/i;

/**
 * Korean names a reward may show. Warframe part blueprints localize to the part
 * itself, without the blueprint word, so the blueprint form goes in front.
 */
export function koreanRewardNames(item: SortedItem): string[] {
  const english = String(item.name || "");
  const uniqueName = typeof item.uniqueName === "string" ? item.uniqueName : null;
  const localized = localizedNameFields(uniqueName, english).displayName;
  if (!localized) return [];

  const names = [localized];
  if (/\bBlueprint$/.test(english)) {
    const pattern = localizeName(BLUEPRINT_PATTERN_KEY, BLUEPRINT_PATTERN_EN);
    const blueprintWord = pattern.replace("|ITEM|", "").trim();
    if (blueprintWord && !localized.includes(blueprintWord)) {
      names.unshift(pattern.replace("|ITEM|", localized));
    }
  }

  // Quantity rewards share a name with the single reward ("2X Forma Blueprint"),
  // so the count has to stay part of the name.
  const quantity = QUANTITY_PREFIX_RE.exec(english);
  return quantity ? names.map((name) => `${quantity[1]}X ${name}`) : names;
}

// The card prints the count as "2 X". Korean OCR reads it as two words, which the
// noise filter drops, or welds it onto the name with the X as a roman numeral or
// ")(". Either way the single reward's name would win. The gold-masked read may
// lead with a stray mark from the card border.
const READ_QUANTITY_RE = /^[^\p{L}\p{N}]*(\d+)\s*(?:[xX×ⅹⅩ]|\)\()\s*/u;

/** The cleaned read with the raw read's leading count spelled "2X ", as names are. */
export function normalizeQuantityPrefix(raw: string, cleaned: string): string {
  const quantity = READ_QUANTITY_RE.exec(raw);
  if (!quantity) return cleaned;
  const name = cleaned.replace(READ_QUANTITY_RE, "").trim();
  return name ? `${quantity[1]}X ${name}` : "";
}

let cachedIndex: { items: SortedItem[]; locale: string; index: KoRewardIndex<SortedItem> } | null =
  null;

function indexFor(sortedItems: SortedItem[]): KoRewardIndex<SortedItem> {
  const locale = getGameLocale();
  if (cachedIndex?.items === sortedItems && cachedIndex.locale === locale) return cachedIndex.index;
  const index = buildKoRewardIndex(sortedItems, koreanRewardNames);
  cachedIndex = { items: sortedItems, locale, index };
  return index;
}

export function rankKoreanRewardCandidates(
  ocrText: string,
  sortedItems: SortedItem[],
  limit: number,
): KoRewardCandidate<SortedItem>[] {
  return rankKoRewardCandidates(ocrText, indexFor(sortedItems), limit);
}
