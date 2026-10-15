import type { Translator } from "../i18n.js";

/** The game-language label main attached for an English world-state text, or the
 *  text itself. Job titles and challenges are keyed by their path instead, since
 *  the English shown for them is pieced together and names nothing on its own. */
export function worldLabel(
  labels: Readonly<Record<string, string>> | undefined,
  english: string | null | undefined,
  key: string | null | undefined = english,
): string {
  return (key && labels?.[key]) || english || "";
}

// The cycle rows are named by their key; these are the places the game names.
const CYCLE_PLACES: Readonly<Record<string, string>> = {
  earth: "Earth",
  cetus: "Cetus",
  vallis: "Orb Vallis",
  cambion: "Cambion Drift",
  duviri: "Duviri",
};

/** A cycle row's place in the game language, or null to keep the English name. */
export function cyclePlaceLabel(
  labels: Readonly<Record<string, string>> | undefined,
  key: string,
): string | null {
  const place = CYCLE_PLACES[key];
  return (place && labels?.[place]) || null;
}

/** "Stage 2" and "Bounty" as the reward tables label a bounty's stages. */
export function bountyStageLabel(label: string, t: Translator): string {
  const stage = /^Stage (\d+)$/.exec(label);
  if (stage) return t("world.bountyStage", { n: Number(stage[1]) });
  return label === "Bounty" ? t("world.bountyLabel") : label;
}

/** A reward row's name in the game language, its count ("2X", "200") kept. */
export function rewardItemLabel(
  name: string,
  entry: { name?: string | null; displayName?: string | null } | null | undefined,
): string {
  const english = entry?.name;
  if (!english || !entry?.displayName || !name.toLowerCase().endsWith(english.toLowerCase())) {
    return name;
  }
  return name.slice(0, name.length - english.length) + entry.displayName;
}
