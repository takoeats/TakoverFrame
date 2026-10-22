// Korean riven card reads, rewritten as the English card text the riven parser
// reads: a title line, then one "<value> <stat>" line per stat. Windows OCR
// returns the card as one run of words, so stats are found by their values.

import { normalizeErrorMessage } from "../../config/shared/errors";
import { cleanStatLabel } from "../rivenNames";
import { readPepDict, readPepExport } from "../bundledGameData";
import { levenshteinDistance } from "../rewardScannerUtils";
import { withScope } from "../logger";
import { toJamo } from "./hangul";

const log = withScope("koRivenText");

interface KoStatLabel {
  korean: string;
  english: string;
  /** The card prints the value after the name, as faction damage does. */
  valueAfter: boolean;
}

interface KoRivenLabels {
  labels: KoStatLabel[];
  /** Words a label carries besides its name: qualifiers and trailing words. */
  ignored: Set<string>;
}

type RivenModExport = {
  upgradeEntries?: Array<{ upgradeValues?: Array<{ locTag?: unknown }> }>;
};

// Stats the game rolls that the bundled export does not list yet (Status Damage,
// worded as on the Elementalist mods).
const EXTRA_LABELS: readonly KoStatLabel[] = [
  { korean: "상태이상피해", english: "Status Damage", valueAfter: false },
];

const PLACEHOLDER = /\|[^|]*\|/;
const QUALIFIER = /[(（][^)）]*[)）]?/g;

function hangulOnly(text: string): string {
  return text.normalize("NFC").replace(/[^가-힣]/g, "");
}

/** Labels from the Korean and English string tables for one riven stat each. */
function buildKoRivenLabels(
  mods: Record<string, RivenModExport>,
  korean: Readonly<Record<string, string>>,
  english: Readonly<Record<string, string>>,
): KoRivenLabels {
  const labels = new Map<string, KoStatLabel>();
  const ignored = new Set<string>();
  for (const [key, mod] of Object.entries(mods)) {
    if (!key.includes("/Randomized/") || !Array.isArray(mod.upgradeEntries)) continue;
    for (const entry of mod.upgradeEntries) {
      const locTag = entry.upgradeValues?.[0]?.locTag;
      if (typeof locTag !== "string") continue;
      const ko = korean[locTag];
      const en = cleanStatLabel(english[locTag] ?? "");
      if (!ko || !en) continue;
      for (const qualifier of ko.match(QUALIFIER) ?? []) {
        if (hangulOnly(qualifier)) ignored.add(hangulOnly(qualifier));
      }
      const parts = ko.replace(QUALIFIER, "").split(PLACEHOLDER);
      const before = hangulOnly(parts[0] ?? "");
      const after = hangulOnly(parts.slice(1).join(""));
      // Slide crit puts one word after its value; the name is the longer side.
      const valueAfter = before.length > after.length;
      const name = valueAfter ? before : after;
      const rest = valueAfter ? after : before;
      if (rest) ignored.add(rest);
      if (name && !labels.has(name)) labels.set(name, { korean: name, english: en, valueAfter });
    }
  }
  for (const extra of EXTRA_LABELS) {
    if (!labels.has(extra.korean)) labels.set(extra.korean, extra);
  }
  const sorted = [...labels.values()].sort((a, b) => b.korean.length - a.korean.length);
  return { labels: sorted, ignored };
}

let cached: KoRivenLabels | null = null;

function defaultLabels(): KoRivenLabels {
  if (cached) return cached;
  try {
    cached = buildKoRivenLabels(
      (readPepExport("ExportUpgrades") ?? {}) as Record<string, RivenModExport>,
      readPepDict("ko") ?? {},
      readPepDict("en") ?? {},
    );
  } catch (err) {
    log.warn("Korean riven stat names unreadable:", normalizeErrorMessage(err));
    cached = { labels: [...EXTRA_LABELS], ignored: new Set() };
  }
  return cached;
}

// A lock icon reads as a digit glued to the sign ("6+154.4%"); the sign anchors
// the value, so the digit falls into the text before it and is dropped there.
const VALUE =
  /[+\-\u2013]\s*\d+(?:\s*[.,]\s*\d+)?\s*(?:%|초)?|(?<![A-Za-z])[xX×]\s*\d+(?:[.,]\d+)?/g;

function englishValue(raw: string): string {
  const value = raw.replace(/\s+/g, "").replace(",", ".").replace("\u2013", "-");
  if (/^[xX×]/.test(value)) return `x${value.slice(1)}`;
  return value.replace(/초$/, "s");
}

/** The one label within OCR noise of a word, or null. Edits count in jamo. */
function nearestLabel(word: string, labels: readonly KoStatLabel[]): KoStatLabel | null {
  const jamo = toJamo(word);
  let best: KoStatLabel | null = null;
  let bestDistance = Infinity;
  let tied = false;
  for (const label of labels) {
    const target = toJamo(label.korean);
    const distance = levenshteinDistance(jamo, target);
    if (distance < bestDistance) {
      best = label;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }
  if (!best || tied) return null;
  return bestDistance <= Math.max(1, Math.floor(toJamo(best.korean).length / 5)) ? best : null;
}

type Token = { kind: "value"; text: string } | { kind: "stat"; label: KoStatLabel | string };

/** Labels in a run of Hangul between two values, longest first from the start. */
function statsInSegment(text: string, known: KoRivenLabels, title: boolean): KoStatLabel[] | null {
  const hangul = hangulOnly(text.replace(QUALIFIER, ""));
  if (title) {
    // Only a value-after stat sits between the title and the first value.
    const tail = known.labels.find((label) => label.valueAfter && hangul.endsWith(label.korean));
    return tail ? [tail] : [];
  }
  const found: KoStatLabel[] = [];
  let rest = hangul;
  while (rest) {
    const label = known.labels.find((candidate) => rest.startsWith(candidate.korean));
    if (!label) break;
    found.push(label);
    rest = rest.slice(label.korean.length);
  }
  if (!rest || known.ignored.has(rest)) return found;
  const near = nearestLabel(rest, known.labels);
  if (near) return [...found, near];
  return found.length > 0 && rest.length < 2 ? found : null;
}

/**
 * English card text for a Korean read, or "" when it holds no value. A run of
 * Hangul that names no stat stays as is, so the parser reports the line.
 */
export function koreanRivenTextToEnglish(raw: string, known = defaultLabels()): string {
  const text = String(raw || "")
    .normalize("NFC")
    .replace(/[0O]\/[0O]/g, "%");
  const tokens: Token[] = [];
  let title = "";
  let cursor = 0;
  const pushSegment = (segment: string, first: boolean): void => {
    const stats = statsInSegment(segment, known, first);
    if (stats === null) {
      tokens.push({ kind: "stat", label: hangulOnly(segment) });
      return;
    }
    for (const label of stats) tokens.push({ kind: "stat", label });
  };
  for (const match of text.matchAll(VALUE)) {
    const segment = text.slice(cursor, match.index);
    if (cursor === 0) {
      // The riven's own name is Latin in every language, so the title ends there.
      title = (/^.*[A-Za-z]/s.exec(segment)?.[0] ?? "").trim();
      pushSegment(segment, true);
    } else {
      pushSegment(segment, false);
    }
    tokens.push({ kind: "value", text: englishValue(match[0]) });
    cursor = match.index + match[0].length;
  }
  if (cursor === 0) return "";
  pushSegment(text.slice(cursor), false);

  const claimed = new Set<number>();
  const valueNear = (index: number, step: number): number => {
    for (let i = index + step; i >= 0 && i < tokens.length; i += step) {
      const token = tokens[i];
      if (token.kind === "stat") return -1;
      if (!claimed.has(i)) return i;
    }
    return -1;
  };
  const lines: string[] = [];
  if (title) lines.push(title);
  tokens.forEach((token, index) => {
    if (token.kind !== "stat") return;
    const after = typeof token.label === "string" ? false : token.label.valueAfter;
    let at = valueNear(index, after ? 1 : -1);
    if (at < 0) at = valueNear(index, after ? -1 : 1);
    if (at >= 0) claimed.add(at);
    const value = at >= 0 ? (tokens[at] as { text: string }).text : "";
    const name = typeof token.label === "string" ? token.label : token.label.english;
    if (name) lines.push(value ? `${value} ${name}` : name);
  });
  return lines.join("\n");
}
