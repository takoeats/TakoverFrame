import { describe, expect, it } from "vitest";

import {
  buildKoRewardIndex,
  rankKoRewardCandidates,
} from "../../../services/takover/koRewardMatcher";

interface Reward {
  name: string;
  ko: string[];
}

const REWARDS: Reward[] = [
  { name: "Ash Prime Systems Blueprint", ko: ["애쉬 프라임 시스템 설계도", "애쉬 프라임 시스템"] },
  { name: "Ash Prime Blueprint", ko: ["애쉬 프라임 설계도"] },
  { name: "Braton Prime Barrel", ko: ["브래튼 프라임 배럴"] },
  { name: "Braton Prime Receiver", ko: ["브래튼 프라임 리시버"] },
  { name: "Braton Prime Stock", ko: ["브래튼 프라임 스톡"] },
  { name: "Forma Blueprint", ko: ["포르마 설계도"] },
  { name: "2X Forma Blueprint", ko: ["2X 포르마 설계도"] },
];

const index = buildKoRewardIndex(REWARDS, (reward) => reward.ko);

function top(read: string) {
  return rankKoRewardCandidates(read, index, 4)[0];
}

describe("Korean reward matcher", () => {
  it("matches an exact read regardless of spacing", () => {
    const best = top("애쉬프라임 시스템 설계도");
    expect(best.item?.name).toBe("Ash Prime Systems Blueprint");
    expect(best.mode).toBe("exact");
    expect(best.confidence).toBe(1);
  });

  it("recovers the real 0H misread as an exact match", () => {
    expect(top("0H쉬 프라임 시스템 설계도")).toMatchObject({
      item: { name: "Ash Prime Systems Blueprint" },
      mode: "exact",
    });
  });

  it("takes a one-jamo OCR error as a confident fuzzy match", () => {
    // Final consonant misread: the last syllable of "prime" read with NG instead of M.
    const best = top("브래튼 프라잉 배럴");
    expect(best.item?.name).toBe("Braton Prime Barrel");
    expect(best.mode).toBe("fuzzy");
    expect(best.confidence).toBeGreaterThan(0.9);
  });

  it("tells sibling parts apart", () => {
    expect(top("브래튼 프라임 리시버").item?.name).toBe("Braton Prime Receiver");
    expect(top("브래튼 프라임 스톡").item?.name).toBe("Braton Prime Stock");
  });

  it("keeps the quantity apart from the single reward", () => {
    expect(top("2X 포르마 설계도").item?.name).toBe("2X Forma Blueprint");
    expect(top("포르마 설계도").item?.name).toBe("Forma Blueprint");
  });

  it("finds a name inside a read with noise around it", () => {
    const best = top("ㅣ 포르마 설계도 :");
    expect(best.item?.name).toBe("Forma Blueprint");
  });

  it("prefers the longer name when a read holds both", () => {
    // The bare part name is an alias of the blueprint, never a reward of its own.
    expect(top("애쉬 프라임 시스템 설계도 ...").item?.name).toBe("Ash Prime Systems Blueprint");
  });

  it("does not guess between parts when the part word was clipped", () => {
    const ranked = rankKoRewardCandidates("브래튼 프라임", index, 4);
    expect(ranked[0].confidence).toBeLessThan(0.86);
  });

  it("reports no item for an empty read", () => {
    expect(rankKoRewardCandidates("  ", index)).toEqual([
      { item: null, confidence: 0, score: 0, mode: "none" },
    ]);
  });

  it("returns the item with its confidence attached, keeping its own fields", () => {
    const best = top("브래튼 프라임 배럴");
    expect(best.item).toMatchObject({ name: "Braton Prime Barrel", confidence: 1 });
    expect(best.item?.ko).toEqual(["브래튼 프라임 배럴"]);
  });
});
