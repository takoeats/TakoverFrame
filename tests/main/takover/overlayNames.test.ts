import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setGameLocale } from "../../../services/gameLocale";
import * as itemDb from "../../../services/itemDatabase";
import { partDisplayName, rewardDisplayName } from "../../../services/takover/overlayNames";

// Runs against the real bundled names, including a prime DE has no key for yet.
const FORMA_BLUEPRINT = "/Lotus/Types/Recipes/Components/FormaBlueprint";
const CITRINE_PRIME = "/Lotus/Powersuits/Geode/CitrinePrime";
const CITRINE_PRIME_CHASSIS = "/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeChassisComponent";
const CITRINE_PRIME_BLUEPRINT = "/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeBlueprint";

beforeAll(() => {
  itemDb.buildDatabase();
  setGameLocale("ko");
});

afterAll(() => {
  setGameLocale("en");
});

describe("overlay display names", () => {
  it("names a reward in the game language and keeps its bonus count", () => {
    expect(rewardDisplayName(CITRINE_PRIME_CHASSIS, "Citrine Prime Chassis Blueprint")).toEqual({
      displayName: "시트린 프라임 섀시",
    });
    expect(rewardDisplayName(FORMA_BLUEPRINT, "2X Forma Blueprint")).toEqual({
      displayName: "2X 포르마 설계도",
    });
  });

  it("names a set part without the set's name, as the English chip does", () => {
    const part = (uniqueName: string, name: string) =>
      partDisplayName(CITRINE_PRIME, "Citrine Prime", uniqueName, name);
    expect(part(CITRINE_PRIME_CHASSIS, "Citrine Prime Chassis Blueprint")).toEqual({
      displayName: "섀시",
    });
    expect(part(CITRINE_PRIME_BLUEPRINT, "Citrine Prime Blueprint")).toEqual({
      displayName: "설계도",
    });
  });

  it("adds nothing in English, so the overlay keeps showing name", () => {
    setGameLocale("en");
    try {
      expect(rewardDisplayName(CITRINE_PRIME_CHASSIS, "Citrine Prime Chassis Blueprint")).toEqual(
        {},
      );
      expect(partDisplayName(CITRINE_PRIME, "Citrine Prime", CITRINE_PRIME_CHASSIS, "x")).toEqual(
        {},
      );
    } finally {
      setGameLocale("ko");
    }
  });
});
