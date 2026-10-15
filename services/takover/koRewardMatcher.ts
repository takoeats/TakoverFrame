// Ranks Korean reward-name reads against the relic reward list. Returns the same
// shape as rankRewardCandidatesDetailed so the slot scan gates treat both alike:
// exact > substring > fuzzy, in disjoint score bands.

import { compactKoreanText, toJamo } from "./hangul";

type MatchMode = "exact" | "substring" | "fuzzy" | "none";

export interface KoRewardCandidate<T> {
  item: (T & { confidence: number }) | null;
  confidence: number;
  score: number;
  mode: MatchMode;
}

interface IndexEntry<T> {
  item: T;
  /** Compacted jamo spellings this item may appear under on screen. */
  forms: readonly string[];
  /** The forms split at the "Prime" word into base and part, for prime parts. */
  splits: ReadonlyArray<{ base: string; tail: string }>;
}

export interface KoRewardIndex<T> {
  readonly entries: ReadonlyArray<IndexEntry<T>>;
  /** Distinct prime bases (Protea), in jamo. */
  readonly bases: readonly string[];
}

// A read holding the whole name plus noise scores from here up to 1, so the
// slot scan's 0.92 substring gate passes it.
const CONTAINED_CONFIDENCE_FLOOR = 0.92;
// A clipped read (second line lost) must still cover most of the name; shorter
// pieces are shared by every part of the same weapon.
const MIN_PARTIAL_READ_RATIO = 0.6;
// The name found inside a longer read pays for the rest of the read.
const WINDOW_PENALTY = 0.95;
const MAX_FUZZY_CONFIDENCE = 0.97;
const MIN_REPORTED_CONFIDENCE = 0.5;

// A two-line name can lose its middle under the item art, which leaves the whole-name
// distance to a sibling base (Protea vs Frost) one jamo away. The base is then read
// off the front and the part off the rest, each only when it stands clear of the
// runner-up, and the pair is lifted over the fuzzy gate.
const PRIME_WORD = "프라임";
const STRUCTURAL_CONFIDENCE = 0.9;
const MIN_BASE_SIMILARITY = 0.85;
const MIN_BASE_MARGIN = 0.2;
const MIN_TAIL_SIMILARITY = 0.6;
const MIN_TAIL_MARGIN = 0.08;
// One-syllable bases (Bo, Fang) are jamo prefixes of longer ones (Volnus, Pangolin).
const MIN_BASE_JAMO = 5;
// Past the Prime word the rest must still hold some of the part: one syllable or
// noise names no part.
const MIN_PART_READ_JAMO = 4;
const MIN_PART_READ_RATIO = 0.4;

function jamoOf(text: string): string {
  return toJamo(compactKoreanText(text));
}

const PRIME_JAMO = jamoOf(PRIME_WORD).length;

// Item art over the text reads as stray Latin, and no prime name spells its base in
// Latin (only a "<ARCHWING>" tag), so the split drops it on both sides.
function hangulOnly(jamo: string): string {
  return jamo.replace(/[a-z]/g, "");
}

export function buildKoRewardIndex<T>(
  items: readonly T[],
  namesOf: (item: T) => readonly string[],
): KoRewardIndex<T> {
  const entries: IndexEntry<T>[] = [];
  const bases = new Set<string>();
  for (const item of items) {
    const names = namesOf(item);
    const forms = [...new Set(names.map(jamoOf))].filter(Boolean);
    if (forms.length === 0) continue;
    const splits: Array<{ base: string; tail: string }> = [];
    for (const name of names) {
      const at = name.indexOf(PRIME_WORD);
      if (at <= 0) continue;
      const split = {
        base: hangulOnly(jamoOf(name.slice(0, at))),
        tail: hangulOnly(jamoOf(name.slice(at))),
      };
      if (split.base.length < MIN_BASE_JAMO) continue;
      splits.push(split);
      bases.add(split.base);
    }
    entries.push({ item, forms, splits });
  }
  return { entries, bases: [...bases] };
}

let rowA = new Uint16Array(64);
let rowB = new Uint16Array(64);

/**
 * Edit distance from `name` to `read`, or with `anywhere` to its best substring
 * (Sellers). Two reused rows: a full-list rank runs this ~1200 times per read.
 */
function editDistance(read: string, name: string, anywhere: boolean): number {
  const width = read.length + 1;
  if (rowA.length < width) {
    rowA = new Uint16Array(width * 2);
    rowB = new Uint16Array(width * 2);
  }
  let prev = rowA;
  let cur = rowB;
  for (let j = 0; j < width; j++) prev[j] = anywhere ? 0 : j;
  for (let i = 1; i <= name.length; i++) {
    cur[0] = i;
    const ch = name.charCodeAt(i - 1);
    for (let j = 1; j < width; j++) {
      const cost = read.charCodeAt(j - 1) === ch ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  if (!anywhere) return prev[width - 1];
  let best = name.length;
  for (let j = 0; j < width; j++) best = Math.min(best, prev[j]);
  return best;
}

/** Fewest edits turning some prefix of `read` into `base`, and where that prefix ends. */
function prefixDistance(read: string, base: string): { distance: number; end: number } {
  const width = read.length + 1;
  if (rowA.length < width) {
    rowA = new Uint16Array(width * 2);
    rowB = new Uint16Array(width * 2);
  }
  let prev = rowA;
  let cur = rowB;
  for (let j = 0; j < width; j++) prev[j] = j;
  for (let i = 1; i <= base.length; i++) {
    cur[0] = i;
    const ch = base.charCodeAt(i - 1);
    for (let j = 1; j < width; j++) {
      const cost = read.charCodeAt(j - 1) === ch ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  let end = 0;
  for (let j = 1; j < width; j++) if (prev[j] < prev[end]) end = j;
  return { distance: prev[end], end };
}

function similarity(read: string, name: string): number {
  const longest = Math.max(read.length, name.length);
  return longest === 0 ? 0 : 1 - editDistance(read, name, false) / longest;
}

function scoreForm(
  read: string,
  name: string,
): { confidence: number; score: number; mode: MatchMode } | null {
  if (read === name) return { confidence: 1, score: 1000, mode: "exact" };

  // Longer names win ties: a read of a full part name also contains shorter names.
  const lengthBonus = Math.min(8, name.length / 8);
  if (read.includes(name)) {
    const confidence =
      CONTAINED_CONFIDENCE_FLOOR + (1 - CONTAINED_CONFIDENCE_FLOOR) * (name.length / read.length);
    return { confidence, score: 400 + confidence * 92 + lengthBonus, mode: "substring" };
  }
  if (name.includes(read) && read.length >= name.length * MIN_PARTIAL_READ_RATIO) {
    const confidence = read.length / name.length;
    return { confidence, score: 400 + confidence * 92 + lengthBonus, mode: "substring" };
  }

  let confidence = similarity(read, name);
  if (read.length > name.length) {
    const inside = 1 - editDistance(read, name, true) / name.length;
    confidence = Math.max(confidence, inside * WINDOW_PENALTY);
  }
  confidence = Math.min(MAX_FUZZY_CONFIDENCE, confidence);
  if (confidence < MIN_REPORTED_CONFIDENCE) return null;
  return { confidence, score: confidence * 100, mode: "fuzzy" };
}

/** The best score when it clears `floor` and leads the runner-up by `margin`. */
function clearWinner<K>(scored: Array<{ key: K; value: number }>, floor: number, margin: number) {
  scored.sort((a, b) => b.value - a.value);
  const [best, second] = scored;
  if (!best || best.value < floor) return null;
  if (second && best.value - second.value < margin) return null;
  return best;
}

/** Base off the front of the read, then the part off the rest; see PRIME_WORD. */
function matchCoveredName<T>(fullRead: string, index: KoRewardIndex<T>): IndexEntry<T> | null {
  const read = hangulOnly(fullRead);
  const bases = index.bases.map((base) => {
    const { distance, end } = prefixDistance(read, base);
    return { key: { base, end }, value: 1 - distance / base.length };
  });
  const base = clearWinner(bases, MIN_BASE_SIMILARITY, MIN_BASE_MARGIN);
  if (!base) return null;

  const rest = read.slice(base.key.end);
  const parts: Array<{ key: IndexEntry<T>; value: number }> = [];
  for (const entry of index.entries) {
    let best = -1;
    for (const split of entry.splits) {
      if (split.base !== base.key.base) continue;
      const partRead = rest.length - PRIME_JAMO;
      if (partRead < MIN_PART_READ_JAMO) continue;
      if (partRead < (split.tail.length - PRIME_JAMO) * MIN_PART_READ_RATIO) continue;
      best = Math.max(best, similarity(rest, split.tail));
    }
    if (best >= 0) parts.push({ key: entry, value: best });
  }
  return clearWinner(parts, MIN_TAIL_SIMILARITY, MIN_TAIL_MARGIN)?.key ?? null;
}

export function rankKoRewardCandidates<T>(
  ocrText: string,
  index: KoRewardIndex<T>,
  limit = 5,
): KoRewardCandidate<T>[] {
  const read = toJamo(compactKoreanText(ocrText));
  if (!read) return [{ item: null, confidence: 0, score: 0, mode: "none" }];

  const ranked: Array<KoRewardCandidate<T> & { nameLength: number; entry: IndexEntry<T> }> = [];
  for (const entry of index.entries) {
    let best: { confidence: number; score: number; mode: MatchMode; nameLength: number } | null =
      null;
    for (const form of entry.forms) {
      const scored = scoreForm(read, form);
      if (scored && (!best || scored.score > best.score)) {
        best = { ...scored, nameLength: form.length };
      }
    }
    if (!best) continue;
    ranked.push({
      item: { ...entry.item, confidence: Number(best.confidence.toFixed(3)) },
      confidence: best.confidence,
      score: best.score,
      mode: best.mode,
      nameLength: best.nameLength,
      entry,
    });
  }

  ranked.sort(
    (a, b) => b.score - a.score || b.confidence - a.confidence || b.nameLength - a.nameLength,
  );

  const top = ranked[0];
  if (!top || (top.mode === "fuzzy" && top.confidence < STRUCTURAL_CONFIDENCE)) {
    const covered = matchCoveredName(read, index);
    // Only a second opinion: the split must agree with the whole-name ranking.
    if (covered && top?.entry === covered) {
      const others = ranked.filter((candidate) => candidate.entry !== covered);
      ranked.splice(0, ranked.length, {
        item: { ...covered.item, confidence: STRUCTURAL_CONFIDENCE },
        confidence: STRUCTURAL_CONFIDENCE,
        score: STRUCTURAL_CONFIDENCE * 100,
        mode: "fuzzy",
        nameLength: 0,
        entry: covered,
      });
      ranked.push(...others);
    }
  }
  return ranked
    .slice(0, Math.max(1, limit))
    .map(({ nameLength: _nameLength, entry: _entry, ...candidate }) => candidate);
}
