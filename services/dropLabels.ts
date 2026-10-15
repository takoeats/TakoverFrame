// Drop-table names in the game language. The tables are English only, so items go
// through the item database and the rest through DE's dictionary read backwards;
// composed places ("Mantle (Earth), Rotation A") are split and put back together.
// English stays the row's key; a label rides along only where the text moved.

import type { DropRow } from "../config/shared/dropTypes";
import { normalizeErrorMessage } from "../config/shared/errors";
import { readPepDict } from "./bundledGameData";
import { DEFAULT_GAME_LOCALE, getGameLocale } from "./gameLocale";
import { getAllItems, localizedNameFields, lookupItemByNameOrSlug } from "./itemDatabase";
import { withScope } from "./logger";

const log = withScope("dropLabels");

// Words the drop tables add around DE names that DE's dictionary has no entry for.
// |R|, |N|, |MIN|, |MAX| and |PLACE| are filled in; a locale without a table keeps
// these parts in English.
interface DropPhrases {
  rotation: string;
  bounty: string;
  level: string;
  stage: string;
  stageOf: string;
  words: Readonly<Record<string, string>>;
}

const PHRASES: Readonly<Record<string, DropPhrases>> = {
  ko: {
    rotation: "로테이션 |R|",
    bounty: "레벨 |MIN| - |MAX| |PLACE| 의뢰",
    level: "레벨 |MIN| - |MAX|",
    stage: "|N|단계",
    stageOf: "|N|/|M|단계",
    words: {
      caches: "저장고",
      extra: "추가",
      sortie: "출격",
      arbitrations: "중재",
      "final stage": "최종 단계",
      "low risk": "저위험",
      "medium risk": "중위험",
      "high risk": "고위험",
      hard: "어려움",
      "first completion": "첫 완료",
      "subsequent completions": "이후 완료",
    },
  },
};

const RELIC_ERA_KEY = "/Lotus/Language/Relics/Era_";
const RELIC_NAME_KEY = "/Lotus/Language/Relics/VoidProjectionName";
const BLUEPRINT_KEY = "/Lotus/Language/Items/BlueprintAndItem";
const BLUEPRINT_SUFFIX = " Blueprint";
const RELIC_NAME = /^(Lith|Meso|Neo|Axi|Requiem|Vanguard) (\S+) Relic$/;
// "2X Forma Blueprint" and "100 Endo": the count stays, the name moves.
const COUNTED = /^(\d[\d,]*\s*x\s+|\d[\d,]*\s+)(.+)$/i;
const ROTATION = /^(.+), Rotation ([A-Z])$/;
const TRAILING_PARENS = /^(.*\S) \(([^()]+)\)$/;
const BOUNTY = /^Level\s+(\d+)\s*-\s*(\d+)\s+(.+) Bounty$/;
const LEVEL_RANGE = /^Level\s+(\d+)\s*-\s*(\d+)(?:\s+(.+))?$/;
// "Stage 2, Stage 3 of 4, and Stage 3 of 5"
const STAGE = /^Stage (\d+)(?: of (\d+))?$/;
const STAGE_LIST_SEPARATOR = /, (?:and )?/;
// Tooltips and quest text share the dictionary; a name is short and has no tags.
const MAX_NAME_LENGTH = 80;

interface LabelTables {
  locale: string;
  phrases: DropPhrases | null;
  /** DE's whole dictionary; the item-name table the app loads lacks relic eras. */
  dict: Readonly<Record<string, string>>;
  words: Map<string, string>;
  items: Map<string, string>;
  places: Map<string, string>;
  /** Labels lowercased without spaces, as a search compares them. */
  compact: Map<string, string>;
}

let tables: LabelTables | null = null;

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\|([A-Z]+)\|/g, (whole, key: string) => values[key] ?? whole);
}

// One English word can sit under several keys translated differently; the
// spelling most keys agree on wins, and a ready translation beats an untouched one.
function buildWords(locale: string): {
  dict: Readonly<Record<string, string>>;
  words: Map<string, string>;
} {
  const words = new Map<string, string>();
  let english: Readonly<Record<string, string>>;
  let localized: Readonly<Record<string, string>>;
  try {
    english = readPepDict(DEFAULT_GAME_LOCALE) ?? {};
    localized = readPepDict(locale) ?? {};
  } catch (err) {
    log.warn(`${locale}: dictionary unreadable: ${normalizeErrorMessage(err)}`);
    return { dict: {}, words };
  }
  const votes = new Map<string, Map<string, number>>();
  for (const [key, value] of Object.entries(english)) {
    const target = localized[key]?.trim();
    if (!target || value.length > MAX_NAME_LENGTH || /[|<\r\n]/.test(value + target)) continue;
    const word = value.trim().toLowerCase();
    const counts = votes.get(word) ?? new Map<string, number>();
    counts.set(target, (counts.get(target) ?? 0) + 1);
    votes.set(word, counts);
  }
  for (const [word, counts] of votes) {
    let best = "";
    let bestScore = -1;
    for (const [target, count] of counts) {
      const score = count * 2 + (target.toLowerCase() === word ? 0 : 1);
      if (score > bestScore) {
        best = target;
        bestScore = score;
      }
    }
    words.set(word, best);
  }
  return { dict: localized, words };
}

function activeTables(): LabelTables | null {
  const locale = getGameLocale();
  if (locale === DEFAULT_GAME_LOCALE) return null;
  if (tables?.locale !== locale) {
    tables = {
      locale,
      phrases: PHRASES[locale] ?? null,
      ...buildWords(locale),
      items: new Map(),
      places: new Map(),
      compact: new Map(),
    };
  }
  return tables;
}

function word(t: LabelTables, text: string): string | null {
  const key = text.trim().toLowerCase();
  return t.phrases?.words[key] ?? t.words.get(key) ?? null;
}

function relicLabel(t: LabelTables, text: string): string | null {
  const match = RELIC_NAME.exec(text);
  const template = t.dict[RELIC_NAME_KEY];
  if (!match || !template) return null;
  const era = t.dict[`${RELIC_ERA_KEY}${match[1].toUpperCase()}`] || match[1];
  return fill(template, { ERA: era, CATEGORY: match[2] });
}

// The name lookup also answers by slug and part, so only an exact English name
// counts; "Rhino Chassis Blueprint" would otherwise come back as the part.
function itemDbLabel(name: string): string | null {
  const found = lookupItemByNameOrSlug(name, null);
  if (!found || found.item.name.toLowerCase() !== name.toLowerCase()) return null;
  return localizedNameFields(found.uniqueName, name).displayName || null;
}

// The database names some warframe parts "Rhino Chassis Blueprint" while its
// localized key holds the part alone, so a blueprint label that lost the word
// gets it back from the game's own pattern.
function nameLabel(t: LabelTables, name: string): string | null {
  const pattern = t.dict[BLUEPRINT_KEY];
  const own = itemDbLabel(name) ?? relicLabel(t, name) ?? word(t, name);
  if (!pattern || !name.endsWith(BLUEPRINT_SUFFIX)) return own;
  const blueprintWord = pattern.replace("|ITEM|", "").trim();
  if (own) return own.includes(blueprintWord) ? own : pattern.replace("|ITEM|", own);
  const base = name.slice(0, -BLUEPRINT_SUFFIX.length);
  const product = itemDbLabel(base) ?? word(t, base);
  return product ? pattern.replace("|ITEM|", product) : null;
}

function translateItem(t: LabelTables, name: string): string {
  const own = nameLabel(t, name);
  if (own) return own;
  // "Lith A1 Relic (Radiant)"
  const parens = TRAILING_PARENS.exec(name);
  if (parens) {
    const base = nameLabel(t, parens[1]);
    if (base) return `${base} (${word(t, parens[2]) ?? parens[2]})`;
  }
  const counted = COUNTED.exec(name);
  const rest = counted ? nameLabel(t, counted[2]) : null;
  return counted && rest ? counted[1] + rest : name;
}

function translatePlace(t: LabelTables, text: string): string {
  const whole = word(t, text) ?? relicLabel(t, text);
  if (whole) return whole;

  const rotation = ROTATION.exec(text);
  if (rotation) {
    const tail = t.phrases
      ? fill(t.phrases.rotation, { R: rotation[2] })
      : `Rotation ${rotation[2]}`;
    return `${translatePlace(t, rotation[1])}, ${tail}`;
  }
  const parens = TRAILING_PARENS.exec(text);
  if (parens) return `${translatePlace(t, parens[1])} (${translatePlace(t, parens[2])})`;

  if (t.phrases) {
    const phrases = t.phrases;
    const bounty = BOUNTY.exec(text);
    if (bounty) {
      const place = word(t, bounty[3]) ?? bounty[3];
      return fill(phrases.bounty, { MIN: bounty[1], MAX: bounty[2], PLACE: place });
    }
    const level = LEVEL_RANGE.exec(text);
    if (level) {
      const range = fill(phrases.level, { MIN: level[1], MAX: level[2] });
      return level[3] ? `${range} ${translatePlace(t, level[3])}` : range;
    }
    const stages = text.split(STAGE_LIST_SEPARATOR).map((part) => STAGE.exec(part));
    if (stages.every(Boolean)) {
      return stages
        .map((stage) =>
          stage![2]
            ? fill(phrases.stageOf, { N: stage![1], M: stage![2] })
            : fill(phrases.stage, { N: stage![1] }),
        )
        .join(", ");
    }
  }

  // "Dark Refractory, Deimos" or "Entrati (Otak), Neutral": only when every part
  // moved, so a sentence-like name stays whole.
  const parts = text.split(", ");
  if (parts.length > 1) {
    const moved = parts.map((part) => translatePlace(t, part));
    if (moved.every((part, i) => part !== parts[i])) return moved.join(", ");
  }
  return text;
}

function cached(map: Map<string, string>, key: string, build: () => string): string {
  let value = map.get(key);
  if (value === undefined) {
    value = build();
    map.set(key, value);
  }
  return value;
}

function hasItems(): boolean {
  for (const _ in getAllItems()) return true;
  return false;
}

interface DropLabeler {
  item(name: string): string;
  place(name: string): string;
  /** A label lowercased with its spaces removed. */
  compact(label: string): string;
}

/** Game-language names, or null under English. Build one per batch of rows. */
export function dropLabeler(): DropLabeler | null {
  const t = activeTables();
  if (!t) return null;
  // Item names fall back to the dictionary until the item database is built, so
  // nothing read before then is kept.
  const items = hasItems() ? t.items : new Map<string, string>();
  return {
    item: (name) => cached(items, name, () => translateItem(t, name)),
    place: (name) => cached(t.places, name, () => translatePlace(t, name)),
    compact: (label) => cached(t.compact, label, () => label.toLowerCase().replace(/\s+/g, "")),
  };
}

/** Copies of the rows carrying their labels; rows whose text did not move stay shared. */
export function labelDropRows(rows: DropRow[]): DropRow[] {
  const labeler = dropLabeler();
  if (!labeler) return rows;
  return rows.map((row) => {
    const itemLabel = labeler.item(row.item);
    const placeLabel = labeler.place(row.place);
    if (itemLabel === row.item && placeLabel === row.place) return row;
    return {
      ...row,
      ...(itemLabel !== row.item ? { itemLabel } : {}),
      ...(placeLabel !== row.place ? { placeLabel } : {}),
    };
  });
}
