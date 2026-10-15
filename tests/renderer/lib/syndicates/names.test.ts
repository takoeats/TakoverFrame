import { describe, expect, it } from "vitest";

import { localizeSyndicates } from "../../../../src/lib/syndicates/names";
import type { SyndicateMeta } from "../../../../config/shared/syndicateTypes";

const META: SyndicateMeta = {
  tag: "SteelMeridianSyndicate",
  name: "Steel Meridian",
  wikiPage: "Steel Meridian",
  kind: "normal",
  dailyBin: "NORMAL",
  dailyField: "DailyAffiliation",
  titles: [
    { level: 1, name: "Brave", minStanding: 0, maxStanding: 5000 },
    { level: 2, name: "Valiant", minStanding: 5000, maxStanding: 22000 },
  ],
};

describe("localizeSyndicates", () => {
  it("renames the syndicate and its ranks but keeps the wiki page English", () => {
    const [meta] = localizeSyndicates([META], {
      SteelMeridianSyndicate: { name: "스틸 메리디안", titles: { "1": "용기있는" } },
    });

    expect(meta.name).toBe("스틸 메리디안");
    expect(meta.titles.map((title) => title.name)).toEqual(["용기있는", "Valiant"]);
    expect(meta.wikiPage).toBe("Steel Meridian");
  });

  it("leaves a syndicate the game has no names for untouched", () => {
    expect(localizeSyndicates([META], {})[0]).toBe(META);
  });
});
