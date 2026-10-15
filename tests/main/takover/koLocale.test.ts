import { afterEach, describe, expect, it } from "vitest";

import { setGameLocale } from "../../../services/gameLocale";
import { isKoreanClient, keepsKoreanOcrToken } from "../../../services/takover/koLocale";

afterEach(() => {
  setGameLocale("en");
});

describe("Korean client gate", () => {
  it("follows the game language", () => {
    expect(isKoreanClient()).toBe(false);
    setGameLocale("ko");
    expect(isKoreanClient()).toBe(true);
  });

  it("keeps one-syllable Hangul OCR tokens only for the Korean client", () => {
    expect(keepsKoreanOcrToken("보")).toBe(false);
    setGameLocale("ko");
    expect(keepsKoreanOcrToken("보")).toBe(true);
    expect(keepsKoreanOcrToken("x")).toBe(false);
  });
});
