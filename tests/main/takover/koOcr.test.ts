import fs from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { setGameLocale } from "../../../services/gameLocale";
import {
  koreanOcrMissingReason,
  nativeRewardOcrLanguages,
  resetKoreanOcrProbeForTest,
  settleKoreanOcrProbeForTest,
} from "../../../services/takover/koOcr";

// Mimics Windows OCR: languages it has, and whether the engine works at all.
function fakeEngine(installed: string[], engineWorks = true) {
  return vi.fn(async (input: string, _accuracy?: number | null, langs?: string[] | null) => {
    expect(fs.existsSync(input)).toBe(true);
    if (!engineWorks) throw new Error("WinRT OCR engine failed");
    if (langs && !installed.includes(langs[0])) throw new Error("language not supported");
    return { text: "", confidence: 0 };
  });
}

async function probeWith(engine: ReturnType<typeof fakeEngine>): Promise<string[] | null> {
  const languages = nativeRewardOcrLanguages(engine);
  await settleKoreanOcrProbeForTest();
  return languages;
}

afterEach(() => {
  resetKoreanOcrProbeForTest();
  setGameLocale("en");
});

describe("Korean OCR probe", () => {
  it("reports a missing Korean language when the engine itself works", async () => {
    setGameLocale("ko");

    expect(await probeWith(fakeEngine(["en"]))).toEqual(["ko"]);
    expect(koreanOcrMissingReason()).toMatch(/Korean OCR language is not installed/);
  });

  it("stays quiet when Korean is installed", async () => {
    setGameLocale("ko");

    await probeWith(fakeEngine(["en", "ko"]));
    expect(koreanOcrMissingReason()).toBeNull();
  });

  it("leaves a broken engine to upstream's own health check", async () => {
    setGameLocale("ko");

    await probeWith(fakeEngine([], false));
    expect(koreanOcrMissingReason()).toBeNull();
  });

  it("never probes or reports for other game languages", async () => {
    const engine = fakeEngine(["en"]);

    expect(await probeWith(engine)).toBeNull();
    expect(engine).not.toHaveBeenCalled();
    expect(koreanOcrMissingReason()).toBeNull();
  });

  it("probes once however many crops are read", async () => {
    setGameLocale("ko");
    const engine = fakeEngine(["en"]);

    nativeRewardOcrLanguages(engine);
    nativeRewardOcrLanguages(engine);
    await settleKoreanOcrProbeForTest();
    expect(engine).toHaveBeenCalledTimes(2);
  });

  it("drops the warning once the player switches the game language away", async () => {
    setGameLocale("ko");
    await probeWith(fakeEngine(["en"]));

    setGameLocale("en");
    expect(koreanOcrMissingReason()).toBeNull();
  });
});
