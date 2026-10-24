import { afterEach, describe, expect, it, vi } from "vitest";

import { composeKeylessPrimeName } from "../../../services/takover/primeNameFallback";

const names: Record<string, string> = {
  "/Braton": "브래튼",
  "/BratonPrimeStock": "브래튼 프라임 스톡",
  "/BratonPrime": "브래튼 프라임",
  "/Lato": "라토",
  "/LatoPrimeStock": "라토 프라임 스톡",
  "/Odd": "오드",
  "/OddPrimeStock": "오드 프라임 개머리판",
  "/Steflos": "스테플로스",
  "/Citrine": "시트린",
  "/CitrinePrimeChassis": "시트린 프라임 섀시",
  "/BlueprintAndItem": "|ITEM| 설계도",
};
let locale = "ko";

vi.mock("../../../services/gameLocale", () => ({
  DEFAULT_GAME_LOCALE: "en",
  getGameLocale: () => locale,
  localizeName: (key: string | null | undefined, fallback: string) =>
    (key && names[key.replace("/Lotus/Language/Items", "")]) || fallback,
}));

function table(): Record<string, { name: string; nameKey?: string | null }> {
  return {
    a: { name: "Braton", nameKey: "/Braton" },
    b: { name: "Braton Prime Stock", nameKey: "/BratonPrimeStock" },
    j: { name: "Braton Prime", nameKey: "/BratonPrime" },
    c: { name: "Lato", nameKey: "/Lato" },
    d: { name: "Lato Prime Stock", nameKey: "/LatoPrimeStock" },
    e: { name: "Odd", nameKey: "/Odd" },
    f: { name: "Odd Prime Stock", nameKey: "/OddPrimeStock" },
    g: { name: "Steflos", nameKey: "/Steflos" },
    h: { name: "Citrine", nameKey: "/Citrine" },
    i: { name: "Citrine Prime Chassis Blueprint", nameKey: "/CitrinePrimeChassis" },
  };
}

afterEach(() => {
  locale = "ko";
});

describe("keyless prime names", () => {
  it("joins the base name to the suffix most primes give the same English suffix", () => {
    expect(composeKeylessPrimeName(table(), "Steflos Prime Stock")).toBe("스테플로스 프라임 스톡");
  });

  it("composes a main blueprint with the recipe word pattern", () => {
    expect(composeKeylessPrimeName(table(), "Citrine Prime Blueprint")).toBe(
      "시트린 프라임 설계도",
    );
  });

  it("leaves names alone when the base or the suffix is unknown", () => {
    const items = table();
    expect(composeKeylessPrimeName(items, "Nobody Prime Stock")).toBeNull();
    expect(composeKeylessPrimeName(items, "Citrine Prime Carapace")).toBeNull();
    expect(composeKeylessPrimeName(items, "Citrine Chassis")).toBeNull();
  });

  it("does nothing in English", () => {
    locale = "en";
    expect(composeKeylessPrimeName(table(), "Citrine Prime Blueprint")).toBeNull();
  });
});
