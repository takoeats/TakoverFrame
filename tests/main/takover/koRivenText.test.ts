import { describe, expect, it } from "vitest";

import { parseRivenStats } from "../../../ipc/overlay/rivenScanText";
import { koreanRivenTextToEnglish } from "../../../services/takover/koRivenText";

function parse(raw: string) {
  return parseRivenStats(koreanRivenTextToEnglish(raw)).map((stat) => [stat.name, stat.value]);
}

describe("koreanRivenTextToEnglish", () => {
  // Windows OCR of a trait-locked Sobek card, 2560x1440 (2026-10-17).
  const sobek =
    "소벡 Plaga-satiIis 6+154.4% 멀 티샷 +48% 확대율 증가 6+123.40/0 상태 이상 피해 +93.4% 반동";

  it("rewrites a one-line read as the English card", () => {
    expect(koreanRivenTextToEnglish(sobek)).toBe(
      [
        "소벡 Plaga-satiIis",
        "+154.4% Multishot",
        "+48% Zoom",
        "+123.4% Status Damage",
        "+93.4% Weapon Recoil",
      ].join("\n"),
    );
  });

  it("reads the production stat crops of the same card", () => {
    const expected = [
      "+154.4% Multishot",
      "+48% Zoom",
      "+123.4% Status Damage",
      "+93.4% Weapon Recoil",
    ];
    // singleCard at window scale keeps the MR footer; screen scale catches art.
    for (const read of [
      "소벡 Plaga-satiIis 6+154.4% 멀티샷 +48% 확대율 증가 6+123.4% 상태 이상 피해 +93.4% 반동 /4 MR9 0124",
      "丫QT~::누 ; 言 소벡 Plaga-satilis 6+154.4% 멀 티샷 +48% 확대율 증가 6+123.4% 상태 이상 피해 +93.4% 반동",
    ]) {
      expect(koreanRivenTextToEnglish(read).split("\n").slice(1)).toEqual(expected);
    }
  });

  it("gives the parser the stats and the title", () => {
    const diagnostics = { droppedLines: [] as string[] };
    const text = koreanRivenTextToEnglish(sobek.replace("상태 이상 피해", "상태 이상 확률"));
    expect(parseRivenStats(text, diagnostics).map((stat) => [stat.name, stat.value])).toEqual([
      ["Multishot", 154.4],
      ["Zoom", 48],
      ["Status Chance", 123.4],
      ["Weapon Recoil", 93.4],
    ]);
    expect(diagnostics).toEqual({ droppedLines: [], titleSeen: true });
  });

  it("reads a crop without the title", () => {
    expect(parse("+90.1% 치명타 피해 +55% 독성 -30.2% 탄창 용량")).toEqual([
      ["Critical Damage", 90.1],
      ["Toxin", 55],
      ["Magazine Capacity", 30.2],
    ]);
  });

  it("pairs a stat that prints its value after the name", () => {
    expect(
      koreanRivenTextToEnglish("Kuva Sobek Croni-visi 그리니어에 대한 피해 x1.32 +80% 피해"),
    ).toBe("Kuva Sobek Croni-visi\nx1.32 Damage to Grineer\n+80% Damage");
    expect(koreanRivenTextToEnglish("+80% 피해 연속기 지속 시간 +3.2초")).toBe(
      "+80% Damage\n+3.2s Combo Duration",
    );
  });

  it("drops qualifiers and trailing words of a stat", () => {
    expect(
      koreanRivenTextToEnglish(
        "+120% 치명타 확률 (강 공격 시 2배) 슬라이드 공격에 치명타 확률 +60% 추가 +40% 근접 피해",
      ),
    ).toBe("+120% Critical Chance\n+60% Critical Chance for Slide Attack\n+40% Melee Damage");
    expect(koreanRivenTextToEnglish("+70% 연사력 (활 계열 무기에 2배) +5% 상태 이상 확률")).toBe(
      "+70% Fire Rate\n+5% Status Chance",
    );
  });

  it("joins stat names Windows OCR splits or wraps", () => {
    expect(koreanRivenTextToEnglish("+30% 상 태 이 상 지 속 시 간 +12% 재장전 속 도")).toBe(
      "+30% Status Duration\n+12% Reload Speed",
    );
  });

  it("takes a name one jamo off when no other name is as close", () => {
    expect(koreanRivenTextToEnglish("+40% 탄약 최대랑 +20% 발사체 속도")).toBe(
      "+40% Ammo Maximum\n+20% Projectile Speed",
    );
  });

  it("leaves an unknown stat for the parser to report", () => {
    const diagnostics = { droppedLines: [] as string[] };
    const stats = parseRivenStats(
      koreanRivenTextToEnglish("+40% 멀티샷 +20% 무슨옵션"),
      diagnostics,
    );
    expect(stats.map((stat) => stat.name)).toEqual(["Multishot"]);
    expect(diagnostics.droppedLines).toEqual(["+20% 무슨옵션"]);
  });

  it("gives nothing for a read without values", () => {
    expect(koreanRivenTextToEnglish("리벤 접합 닫기")).toBe("");
    expect(koreanRivenTextToEnglish("")).toBe("");
  });
});
