import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_GAME_LOCALE,
  GAME_LOCALES,
  isGameLocale,
  isLocalizingNames,
  localizeName,
  setGameLocale,
} from "../../services/gameLocale";

// Serration: present in every locale we ship, and short enough to eyeball.
const SERRATION = "/Lotus/Language/Items/RifleModDamageAmount";

afterEach(() => {
  setGameLocale(DEFAULT_GAME_LOCALE);
});

describe("game locale", () => {
  it("ships a name table for every advertised locale", () => {
    for (const code of GAME_LOCALES) {
      const file = path.resolve(process.cwd(), "src", "data", "itemNames", `${code}.json`);
      expect(fs.existsSync(file), `missing ${code}.json`).toBe(true);
    }
  });

  it("reports a change once and stays quiet on a repeat", () => {
    expect(setGameLocale("de")).toBe("de");
    expect(setGameLocale("de")).toBeNull();
    expect(setGameLocale("en")).toBe("en");
  });

  it("falls back to English for anything it does not ship", () => {
    setGameLocale("de");

    expect(setGameLocale("kr")).toBe("en");
    expect(setGameLocale("de")).toBe("de");
    expect(setGameLocale(null)).toBe("en");
    expect(isGameLocale("tc")).toBe(true);
    expect(isGameLocale("zz")).toBe(false);
  });

  it("translates a known key and keeps the fallback for everything else", () => {
    expect(localizeName(SERRATION, "Serration")).toBe("Serration");

    setGameLocale("de");

    expect(localizeName(SERRATION, "Serration")).toBe("Einkerbung");
    expect(localizeName("/Lotus/Language/Items/NotAKey", "Serration")).toBe("Serration");
    expect(localizeName(null, "Serration")).toBe("Serration");
    expect(localizeName("", "Serration")).toBe("Serration");
  });

  it("drops in-game icon tags the app cannot draw", () => {
    setGameLocale("ko");

    expect(localizeName("/Lotus/Language/Narmer/ArchonCrystalNiraName", "Amber Archon Shard")).toBe(
      "황색 집정관 샤드",
    );
  });

  it("only claims to be localizing when a table is actually loaded", () => {
    expect(isLocalizingNames()).toBe(false);

    setGameLocale("zh");

    expect(isLocalizingNames()).toBe(true);
    expect(localizeName(SERRATION, "Serration")).toBe("膛线");
  });
});
