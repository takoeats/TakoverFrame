import { describe, expect, it } from "vitest";

import ko from "../../../src/i18n/ko.json";
import { en } from "../../../src/i18n/en";

// tests/main/i18n.test.ts runs these checks for de and zh; this copy runs them for ko.

const ENGLISH_ONLY = [
  "common.whisperBuy",
  "common.whisperSell",
  "common.whisperBuyBulk",
  "common.whisperSellBulk",
];

// Trade shorthand, grade letters and relic tiers read the same in every language.
const LANGUAGE_NEUTRAL = /^(appearance\.label\.grade|inventory\.wt[bs]|relics\.tier\.)/;

// Names, symbols and pure placeholder layouts that read the same in Korean, so
// the English fallback is the right rendering.
const KOREAN_KEEPS_ENGLISH = new Set([
  "analysis.source.gdpr",
  "analysis.unitsShort",
  "arbi.clearMap.cellPlain",
  "arbisched.nodeCount",
  "arbisched.nodeCountSelected",
  "customCss.placeholder",
  "dashboard.lastMission.pickerOption",
  "inventory.value.atLeast",
  "market.wfmTitle",
  "mastery.roadmap.categoryAccessLine",
  "mastery.roadmap.xpAmount",
  "orderbook.rankOption",
  "orderbook.wtb",
  "orderbook.wts",
  "pet.letter",
  "relics.rewardTooltip",
  "rivens.detail.wfmLink",
  "rivens.mr",
  "rivens.rerollCount",
  "settings.creditGameDataValue",
  "settings.inventorySourceAleca",
  "settings.inventorySourceShortManual",
  "settings.linuxDisplayX11",
  "settings.webhookUrlPlaceholder",
  "stats.wfmBadge",
  "world.vs",
]);

const placeholders = (value: string): string[] =>
  [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

const dict: Record<string, string> = ko;

describe("Korean catalogue", () => {
  it("keeps placeholders identical to English", () => {
    const mismatched = Object.entries(dict)
      .filter(([key, value]) => {
        const source = en[key as keyof typeof en];
        return source !== undefined && placeholders(source).join() !== placeholders(value).join();
      })
      .map(([key]) => key);

    expect(mismatched).toEqual([]);
  });

  it("has no entry for strings sent to other players", () => {
    for (const key of ENGLISH_ONLY) expect(dict).not.toHaveProperty(key);
  });

  // Fails when English text arrives without Korean: translate the new keys.
  it("translates every key Korean is expected to carry", () => {
    const untranslated = Object.keys(en).filter(
      (key) =>
        !(key in dict) &&
        !ENGLISH_ONLY.includes(key) &&
        !LANGUAGE_NEUTRAL.test(key) &&
        !KOREAN_KEEPS_ENGLISH.has(key),
    );

    expect(untranslated).toEqual([]);
  });

  it("has no key English does not define", () => {
    expect(Object.keys(dict).filter((key) => !(key in en))).toEqual([]);
  });

  it("leaves a key out rather than copying the English text", () => {
    const copied = Object.entries(dict)
      .filter(([key, value]) => en[key as keyof typeof en] === value)
      .map(([key]) => key);

    expect(copied).toEqual([]);
  });

  it("spells ellipses as three ASCII dots", () => {
    expect(Object.keys(dict).filter((key) => dict[key].includes("…"))).toEqual([]);
  });
});
