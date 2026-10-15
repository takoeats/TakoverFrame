// Game-language <-> English item names for trades, shared by main (reading the
// Korean trade log) and the renderer (showing trade history). Both build it from
// the same localized item projection: uniqueName -> { name, displayName }.

interface NamedItem {
  name?: string;
  displayName?: string;
  tradable?: boolean;
}

export interface TradeNameIndex {
  toEnglish: Map<string, string>;
  toLocal: Map<string, string>;
}

const PAREN_SUFFIX = /^(.*?)\s*\(([^()]*)\)\s*$/;
const KO_RANK = /(\d+)\s*랭크/;

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

// A part blueprint and the part it builds share the English name ("... Systems
// Blueprint"), so the localized name of the blueprint record is the one to show.
function localPriority(uniqueName: string, item: NamedItem): number {
  let score = item.tradable === true ? 2 : 0;
  if (/Blueprint$/.test(item.name ?? "") && /Blueprint$/.test(uniqueName)) score += 1;
  return score;
}

/** Tradable items win a shared localized name; a name two tradable items share
 *  is dropped rather than guessed. */
export function buildTradeNameIndex(items: Record<string, NamedItem>): TradeNameIndex {
  const toEnglish = new Map<string, string>();
  const toLocal = new Map<string, string>();
  const localScore = new Map<string, number>();
  const englishScore = new Map<string, number>();
  const ambiguous = new Set<string>();

  for (const [uniqueName, item] of Object.entries(items)) {
    const english = item.name;
    const local = item.displayName;
    if (!english || !local) continue;

    const key = compact(local);
    const rank = item.tradable === true ? 1 : 0;
    const best = englishScore.get(key);
    if (best === undefined || rank > best) {
      toEnglish.set(key, english);
      englishScore.set(key, rank);
      ambiguous.delete(key);
    } else if (rank === best && toEnglish.get(key) !== english) {
      ambiguous.add(key);
    }

    const priority = localPriority(uniqueName, item);
    if (priority > (localScore.get(english) ?? -1)) {
      toLocal.set(english, local);
      localScore.set(english, priority);
    }
  }
  for (const key of ambiguous) toEnglish.delete(key);
  return { toEnglish, toLocal };
}

// DE's dictionary has no relic names: the Korean client translates only the era
// and keeps the code, so the four eras and Requiem are the whole map.
const RELIC_ERAS: ReadonlyArray<[string, string]> = [
  ["리스", "Lith"],
  ["메소", "Meso"],
  ["네오", "Neo"],
  ["액시", "Axi"],
  ["레퀴엠", "Requiem"],
];
const KO_RELIC = /^(\S+)\s+([A-Z]+\d*)\s*(?:성유물|유물)?$/;
const EN_RELIC = /^(\S+)\s+([A-Z]+\d*) Relic$/;

function englishRelicName(local: string): string | null {
  const match = KO_RELIC.exec(local);
  const era = match && RELIC_ERAS.find(([ko]) => ko === match[1]);
  return era ? `${era[1]} ${match[2]} Relic` : null;
}

function localizedRelicName(english: string): string | null {
  const match = EN_RELIC.exec(english);
  const era = match && RELIC_ERAS.find(([, en]) => en === match[1]);
  return era ? `${era[0]} ${match[2]} 성유물` : null;
}

/** The English name of a Korean trade line, rank kept as "(Rank N)"; null when unknown. */
export function englishTradeItemName(local: string, index: TradeNameIndex): string | null {
  const paren = PAREN_SUFFIX.exec(local);
  const base = paren ? paren[1].trim() : local;
  const english = index.toEnglish.get(compact(base)) ?? englishRelicName(base);
  if (!english) return null;
  if (!paren) return english;
  // Mods log their rarity and rank; the matcher reads only the number.
  const rank = KO_RANK.exec(paren[2]);
  return rank ? `${english} (Rank ${rank[1]})` : `${english} (${paren[2]})`;
}

/** The game-language name for an English trade item name, keeping a "(Rank N)"
 *  suffix and the "+N" that summarizes extra items. Unknown names pass through. */
export function localizedTradeItemName(english: string, index: TradeNameIndex): string {
  const extra = / \+\d+$/.exec(english)?.[0] ?? "";
  const withoutExtra = extra ? english.slice(0, -extra.length) : english;
  const paren = PAREN_SUFFIX.exec(withoutExtra);
  const base = paren ? paren[1].trim() : withoutExtra;
  const local = index.toLocal.get(base) ?? localizedRelicName(base);
  if (!local) return english;
  const rank = paren ? /^rank (\d+)$/i.exec(paren[2]) : null;
  const suffix = !paren ? "" : rank ? ` (${rank[1]} 랭크)` : ` (${paren[2]})`;
  return `${local}${suffix}${extra}`;
}
