// World-state text in the game language. The parsed state stays English because
// fissure alerts, desktop notifications and the wiki's bounty lookup match on it,
// so the translations travel beside it as one table: English text (or a job or
// challenge path) -> label. The renderer swaps the text only where it shows it.

import { FISSURE_MISSION_TYPES } from "../config/shared/missionTypes";
import { normalizeErrorMessage } from "../config/shared/errors";
import { WORLD_STATE_CONFIG } from "../config/runtime/worldState";
import { readPepExport } from "./bundledGameData";
import { dropLabeler } from "./dropLabels";
import { withScope } from "./logger";
import { titleCase } from "../config/shared/textNormalize";
import { getGameLocale } from "./gameLocale";
import { loadRegionTranslation, localizedDictValue } from "./regionNames";
import { getSyndicateNames } from "./syndicateNames";
import { localizedChallengeDesc } from "./worldStateParser";

const log = withScope("worldLabels");

// Shown outside the world state itself: the fissure-alert pickers and the cycle
// rows. Kept in the English the parser and those pickers already use.
const STATIC_TEXT = [
  "Lith",
  "Meso",
  "Neo",
  "Axi",
  "Requiem",
  "Omnia",
  "Ceres",
  "Earth",
  "Eris",
  "Europa",
  "Jupiter",
  "Kuva Fortress",
  "Lua",
  "Mars",
  "Mercury",
  "Neptune",
  "Phobos",
  "Pluto",
  "Saturn",
  "Sedna",
  "Uranus",
  "Venus",
  "Void",
  "Zariman",
  "Deimos",
  "Cetus",
  "Orb Vallis",
  "Cambion Drift",
  "Duviri",
  ...WORLD_STATE_CONFIG.duviriMoods,
];

// Words the dictionary only has inside longer names ("Sorrow Backdrop"); the
// spellings are DE's own from those names.
const WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ko: {
    Sorrow: "슬픔",
    Fear: "공포",
    Joy: "기쁨",
    Anger: "분노",
    Envy: "질투",
    Corrupted: "커럽티드",
    Winter: "겨울",
    Spring: "봄",
    Summer: "여름",
    Autumn: "가을",
  },
};

type Labeler = NonNullable<ReturnType<typeof dropLabeler>>;
type Loose = Record<string, unknown>;

let bounties: Record<string, { name?: unknown }> | null = null;
const missionTypes = new Map<string, Record<string, string>>();

// The parser names mission types from DE's MT_ table or the node's own mission,
// so the label comes from the same key: the dictionary read backwards has
// several spellings for one word ("Spy").
function missionTypeLabels(): Record<string, string> {
  const locale = getGameLocale();
  let labels = missionTypes.get(locale);
  if (labels) return labels;
  labels = {};
  const { dict, regions } = loadRegionTranslation();
  const keys = new Set<string>();
  try {
    for (const entry of Object.values(readPepExport("ExportMissionTypes") ?? {})) {
      const name = asRecord(entry)?.name;
      if (typeof name === "string") keys.add(name);
    }
  } catch (err) {
    log.warn("ExportMissionTypes unreadable:", normalizeErrorMessage(err));
  }
  for (const region of Object.values(regions)) {
    if (typeof region.missionName === "string") keys.add(region.missionName);
  }
  for (const key of keys) {
    const english = dict[key] ? titleCase(dict[key]) : "";
    const localized = localizedDictValue(key);
    if (english && localized && !(english in labels)) labels[english] = titleCase(localized);
  }
  missionTypes.set(locale, labels);
  return labels;
}

function bountyTable(): Record<string, { name?: unknown }> {
  if (!bounties) {
    try {
      bounties = (readPepExport("ExportBounties") ?? {}) as Record<string, { name?: unknown }>;
    } catch (err) {
      log.warn("ExportBounties unreadable:", normalizeErrorMessage(err));
      bounties = {};
    }
  }
  return bounties;
}

function asRecord(value: unknown): Loose | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : null;
}

function records(value: unknown): Loose[] {
  return Array.isArray(value) ? value.map(asRecord).filter((v): v is Loose => v !== null) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// "Apollodorus, Mercury": the parser joins node and planet with a comma, and a
// node DE never translated must not keep the planet in English.
function placeText(labeler: Labeler, value: string): string {
  const whole = labeler.place(value);
  if (whole !== value) return whole;
  const at = value.lastIndexOf(", ");
  if (at < 0) return value;
  return `${labeler.place(value.slice(0, at))}, ${labeler.place(value.slice(at + 2))}`;
}

interface LabelSink {
  labels: Record<string, string>;
  labeler: Labeler;
  put(english: string, label: string | null | undefined): void;
  place(value: unknown): void;
  mission(value: unknown): void;
  item(value: unknown): void;
}

function labelSink(): LabelSink | null {
  const labeler = dropLabeler();
  if (!labeler) return null;
  const labels: Record<string, string> = {};
  const words = WORDS[getGameLocale()] ?? {};
  const missions = missionTypeLabels();
  const sink: LabelSink = {
    labels,
    labeler,
    put(english, label) {
      if (english && label && label !== english) labels[english] = label;
    },
    place(value) {
      const english = text(value);
      if (english) sink.put(english, words[english] ?? placeText(labeler, english));
    },
    mission(value) {
      const english = text(value);
      if (english && missions[english]) sink.put(english, missions[english]);
      else sink.place(english);
    },
    item(value) {
      const english = text(value);
      if (english) sink.put(english, labeler.item(english));
    },
  };
  return sink;
}

/** Labels for the arbitration schedule rows, or null under English. */
export function buildArbiLabels(
  entries: ReadonlyArray<{ node: string; mission: string; faction: string }>,
): Record<string, string> | null {
  const sink = labelSink();
  if (!sink) return null;
  for (const entry of entries) {
    sink.place(entry.node);
    sink.mission(entry.mission);
    sink.place(entry.faction);
  }
  return sink.labels;
}

/** Labels for what the world tab shows, or null under English. */
export function buildWorldLabels(state: unknown): Record<string, string> | null {
  const sink = labelSink();
  if (!sink) return null;
  const { labels, labeler, put, place, mission, item } = sink;

  for (const english of STATIC_TEXT) place(english);
  for (const english of FISSURE_MISSION_TYPES) mission(english);

  const world = asRecord(state);
  if (!world) return labels;

  for (const fissure of records(world.fissures)) {
    place(fissure.tier);
    mission(fissure.missionType);
    place(fissure.node);
  }

  for (const invasion of records(world.invasions)) {
    place(invasion.node);
    for (const side of [asRecord(invasion.attacker), asRecord(invasion.defender)]) {
      place(side?.faction);
      for (const counted of records(asRecord(side?.reward)?.countedItems)) item(counted.type);
    }
  }

  const syndicates = getSyndicateNames();
  for (const group of records(world.bounties)) {
    put(text(group.syndicate), syndicates[text(group.syndicateKey)]?.name);
    for (const job of records(group.jobs)) {
      const jobType = text(job.jobType);
      const title = jobType ? localizedDictValue(bountyTable()[jobType]?.name) : null;
      if (jobType && title) labels[jobType] = title;
      else mission(job.type);
      const challenge = text(job.challenge);
      if (challenge)
        put(text(job.challengeDesc), localizedChallengeDesc(challenge, text(job.ally)));
    }
  }

  for (const hunt of [asRecord(world.sortie), asRecord(world.archonHunt)]) {
    if (!hunt) continue;
    place(hunt.boss);
    // Archon bosses arrive bare ("Nira"); DE names them with the title.
    const boss = text(hunt.boss);
    const titled = `Archon ${boss}`;
    const archon = boss && !labels[boss] ? labeler.place(titled) : titled;
    if (archon !== titled) put(boss, archon);
    for (const entry of records(hunt.missions)) place(entry.node);
  }

  for (const alert of records(world.alerts)) {
    place(alert.node);
    place(alert.faction);
    for (const reward of records(alert.items)) item(reward.name);
  }

  const baro = asRecord(world.voidTrader);
  place(baro?.location);
  for (const entry of records(baro?.inventory)) item(entry.item);
  for (const deal of records(world.dailyDeals)) item(deal.item);

  const steelPath = asRecord(world.steelPath);
  item(asRecord(steelPath?.currentReward)?.name);
  for (const key of ["rotation", "upcoming", "evergreens"]) {
    for (const reward of records(steelPath?.[key])) item(reward.name);
  }

  place(asRecord(world.calendarSeason)?.season);
  const duviri = asRecord(world.duviriCycle);
  place(duviri?.state);
  place(duviri?.nextState);
  for (const set of records(duviri?.choices)) {
    for (const choice of Array.isArray(set.choices) ? set.choices : []) item(choice);
  }
  return labels;
}

/** The state with its labels attached; the cached English object is never touched. */
export function withWorldLabels<T>(state: T): T {
  const world = asRecord(state);
  if (!world) return state;
  const labels = buildWorldLabels(world);
  return labels ? ({ ...world, labels } as T) : state;
}
