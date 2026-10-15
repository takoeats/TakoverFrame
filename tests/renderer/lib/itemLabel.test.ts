import { describe, expect, it } from "vitest";

import { itemLabel, marketItemLabel } from "../../../src/lib/itemLabel";

describe("itemLabel", () => {
  it("prefers the localized name and falls back to English", () => {
    expect(itemLabel({ name: "Serration", displayName: "Einkerbung" })).toBe("Einkerbung");
    expect(itemLabel({ name: "Serration" })).toBe("Serration");
  });

  it("never renders undefined at a caller that has no item yet", () => {
    expect(itemLabel(null)).toBe("");
    expect(itemLabel(undefined)).toBe("");
    expect(itemLabel({})).toBe("");
    expect(itemLabel({ name: "", displayName: "" })).toBe("");
  });
});

describe("marketItemLabel", () => {
  const wfm = {
    "forma blueprint": { url_name: "forma_blueprint", gameRef: "/Lotus/Forma" },
    "new prime set": { url_name: "new_prime_set", gameRef: "/Lotus/NewPrime" },
  };
  const db = {
    "/Lotus/Forma": { name: "Forma Blueprint", displayName: "포르마 설계도" },
    "/Lotus/NewPrime": { name: "New Prime Set" },
  };

  it("shows the game-language name the market's gameRef leads to", () => {
    expect(marketItemLabel("Forma Blueprint", wfm, db)).toBe("포르마 설계도");
  });

  it("keeps the market's English name when no translation exists yet", () => {
    expect(marketItemLabel("New Prime Set", wfm, db)).toBe("New Prime Set");
    expect(marketItemLabel("Unlisted Item", wfm, db)).toBe("Unlisted Item");
    expect(marketItemLabel("", wfm, db)).toBe("");
  });
});
