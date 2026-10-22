import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compactKoreanText } from "../../../services/takover/hangul";
import { setGameLocale } from "../../../services/gameLocale";
import * as itemDb from "../../../services/itemDatabase";
import { getRelicRewardItems } from "../../../services/relicService";
import { isKoreanRewardScan, rewardOcrLanguages } from "../../../services/takover/koLocale";
import {
  koreanRewardNames,
  rankKoreanRewardCandidates,
  normalizeQuantityPrefix,
} from "../../../services/takover/koRewardScan";

// Runs against the real bundled data: the blueprint quirk lives there.
let rewards: ReturnType<typeof getRelicRewardItems>;

beforeAll(() => {
  itemDb.buildDatabase();
  setGameLocale("ko");
  rewards = getRelicRewardItems();
});

afterAll(() => {
  setGameLocale("en");
});

function reward(name: string) {
  const found = rewards.find((item) => item.name === name);
  if (!found) throw new Error(`no relic reward named ${name}`);
  return found;
}

describe("Korean reward scan wiring", () => {
  it("runs only while the game language is Korean", () => {
    expect(isKoreanRewardScan()).toBe(true);
    expect(rewardOcrLanguages()).toEqual(["ko"]);
    setGameLocale("en");
    expect(isKoreanRewardScan()).toBe(false);
    expect(rewardOcrLanguages()).toBeNull();
    setGameLocale("ko");
  });

  it("adds the blueprint word that part blueprints lose in localization", () => {
    expect(koreanRewardNames(reward("Ash Prime Systems Blueprint"))).toEqual([
      "애쉬 프라임 시스템 설계도",
      "애쉬 프라임 시스템",
    ]);
    expect(koreanRewardNames(reward("Ash Prime Blueprint"))).toEqual(["애쉬 프라임 설계도"]);
    expect(koreanRewardNames(reward("Braton Prime Barrel"))).toEqual(["브래튼 프라임 배럴"]);
  });

  it("keeps the quantity in front of quantity rewards", () => {
    expect(koreanRewardNames(reward("2X Forma Blueprint"))).toEqual(["2X 포르마 설계도"]);
    expect(koreanRewardNames(reward("Forma Blueprint"))).toEqual(["포르마 설계도"]);
  });

  it("never gives two rewards the same on-screen name", () => {
    const owners = new Map<string, string>();
    const clashes: string[] = [];
    for (const item of rewards) {
      for (const name of koreanRewardNames(item)) {
        const key = compactKoreanText(name);
        const owner = owners.get(key);
        if (owner && owner !== item.name) clashes.push(`${name}: ${owner} / ${item.name}`);
        owners.set(key, item.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("names nearly every relic reward in Korean", () => {
    const unnamed = rewards.filter((item) => koreanRewardNames(item).length === 0);
    // Rewards newer than the bundled DE dictionary have no Korean name yet.
    expect(unnamed.length / rewards.length).toBeLessThan(0.05);
  });

  // The slot scan's fuzzy gate (isUsableSlotCandidate).
  const FUZZY_GATE = 0.86;

  it("names a two-line part whose middle the item icon covers", () => {
    // Real 1440p slot strips with the part art over the wrapped name's middle (the
    // Lavos read is the colour strip at twice the width).
    const cases: Array<[string, string]> = [
      ["프로티 『임 새시 설계도", "Protea Prime Chassis Blueprint"],
      ["프로티 f임섀시 설계도", "Protea Prime Chassis Blueprint"],
      ["라보스 임 새시 설계도", "Lavos Prime Chassis Blueprint"],
    ];
    for (const [read, name] of cases) {
      const [best] = rankKoreanRewardCandidates(read, rewards, 4);
      expect(best.item?.name, read).toBe(name);
      expect(best.confidence, read).toBeGreaterThanOrEqual(FUZZY_GATE);
    }
  });

  it("names a two-line part whose base end the item icon also covers", () => {
    // Real 1440p reads: the icon took the base's last syllable along with the Prime word.
    const cases: Array<[string, string]> = [
      ["보루 갱 섀시 설계도", "Voruna Prime Chassis Blueprint"],
      ["자이 님 섀시 설계도", "Gyre Prime Chassis Blueprint"],
      ["자이쑤 갱 섀시 설계도", "Gyre Prime Chassis Blueprint"],
      ["칼리빈 갱 새시", "Caliban Prime Chassis Blueprint"],
    ];
    for (const [read, name] of cases) {
      const [best] = rankKoreanRewardCandidates(read, rewards, 4);
      expect(best.item?.name, read).toBe(name);
      expect(best.confidence, read).toBeGreaterThanOrEqual(FUZZY_GATE);
    }
  });

  it("does not name a part whose words left no trace", () => {
    // A real read of Caliban Prime Chassis Blueprint: the Blueprint alone also fits.
    const [best] = rankKoreanRewardCandidates("칼리빈 설계도", rewards, 4);
    expect(best.confidence).toBeLessThan(FUZZY_GATE);
  });

  // The slot scan rescues a fuzzy read from here up to the gate when a slot is empty.
  const NEAR_MISS_FLOOR = 0.8;

  it("keeps a read that lost the base out of the near-miss rescue", () => {
    // Real reads: Valkyr Prime Blueprint (taken for Bo), Larkspur Prime Blueprint
    // (Reaper) and Steflos Prime Receiver, which the reward list lacked (Lex).
    for (const read of ["로 프라임 설 도", "근 결스퍼 프라임 설계도", "스테플로스 프라임 리시버"]) {
      const [best] = rankKoreanRewardCandidates(read, rewards, 4);
      expect(best?.confidence ?? 0, read).toBeLessThan(NEAR_MISS_FLOOR);
    }
  });

  it("keeps a near miss whose base was read", () => {
    const [best] = rankKoreanRewardCandidates("0뢸리 프라임 설계도", rewards, 4);
    expect(best.item?.name).toBe("Yareli Prime Blueprint");
    expect(best.confidence).toBeGreaterThanOrEqual(NEAR_MISS_FLOOR);
  });

  it("does not guess a covered name when the base or the part is ambiguous", () => {
    // A two-syllable base fits Frost as well as Protea; a base alone names no part.
    for (const read of ["프로 『임 새시 설계도", "프로티아 『임"]) {
      const [best] = rankKoreanRewardCandidates(read, rewards, 4);
      expect(best?.confidence ?? 0, read).toBeLessThan(FUZZY_GATE);
    }
  });

  it("matches a real misread against the full reward list", () => {
    const [best] = rankKoreanRewardCandidates("0H쉬 프라임 시스템 설계도", rewards, 4);
    expect(best.item?.name).toBe("Ash Prime Systems Blueprint");
    expect(best.mode).toBe("exact");
  });

  it("keeps the card's 2 X count that the 1-character noise filter drops", () => {
    // Full-screen Windows OCR of a 2560x1440 Korean card reads "2" and "X" as words.
    expect(normalizeQuantityPrefix("2 X 포르마 설계도", "포르마 설계도")).toBe("2X 포르마 설계도");
    expect(normalizeQuantityPrefix("2X 포르마 설계도", "2X 포르마 설계도")).toBe(
      "2X 포르마 설계도",
    );
    expect(normalizeQuantityPrefix("포르마 설계도", "포르마 설계도")).toBe("포르마 설계도");
    expect(normalizeQuantityPrefix("2 X", "")).toBe("");
  });

  it("reads the count the slot strip welds onto the name", () => {
    // Real slot-strip reads of the same card: X as U+2179 or ")(", no space.
    for (const read of ["2ⅹ포르마 설계도", "2)(포르마 설계도", "2×포르마 설계도"]) {
      expect(normalizeQuantityPrefix(read, read), read).toBe("2X 포르마 설계도");
    }
  });

  it("tells the counted forma from the single one against the full reward list", () => {
    const counted = rankKoreanRewardCandidates("2X 포르마 설계도", rewards, 4)[0];
    expect(counted.item?.name).toBe("2X Forma Blueprint");
    expect(counted.mode).toBe("exact");
    const single = rankKoreanRewardCandidates("포르마 설계도", rewards, 4)[0];
    expect(single.item?.name).toBe("Forma Blueprint");
  });

  it("ranks a slot read against the full list fast enough for a live scan", () => {
    rankKoreanRewardCandidates("warm up", rewards, 4);
    const reads = [
      "하이드로이드 프라임 뉴로옵틱스 설계도",
      "브래튼 프라잉 배럴",
      "ㅣ 아크스틸레토 프라임 배럴 :",
    ];
    const started = performance.now();
    for (const read of reads) rankKoreanRewardCandidates(read, rewards, 4);
    const perRead = (performance.now() - started) / reads.length;
    // A scan reads up to 3 texts per slot and 4 slots, inside a ~2s budget.
    expect(perRead).toBeLessThan(100);
  });
});
