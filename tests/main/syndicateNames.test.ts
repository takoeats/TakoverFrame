import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_GAME_LOCALE, setGameLocale } from "../../services/gameLocale";
import { getSyndicateNames } from "../../services/syndicateNames";
import { SYNDICATE_RANKS } from "../../src/data/syndicateRanks";

afterEach(() => {
  setGameLocale(DEFAULT_GAME_LOCALE);
});

describe("syndicate names", () => {
  it("adds nothing under English, the bundled table already reads that way", () => {
    expect(getSyndicateNames()).toEqual({});
  });

  it("names every bundled syndicate and rank in the game language", () => {
    setGameLocale("ko");
    const names = getSyndicateNames();

    expect(names.ArbitersSyndicate.name).toBe("아비터즈 오브 헥시스");
    expect(names.SteelMeridianSyndicate.titles["5"]).toBe("장군");
    expect(names.SteelMeridianSyndicate.titles["-2"]).toBe("적");
    for (const meta of SYNDICATE_RANKS) {
      expect(names[meta.tag], meta.tag).toBeDefined();
      for (const title of meta.titles) {
        expect(
          names[meta.tag].titles[String(title.level)],
          `${meta.tag} ${title.level}`,
        ).toBeTruthy();
      }
    }
  });
});
