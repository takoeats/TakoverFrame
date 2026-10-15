import { describe, expect, it } from "vitest";

import {
  compactKoreanText,
  containsHangul,
  foldHangulLookalikes,
  toJamo,
} from "../../../services/takover/hangul";

describe("hangul helpers", () => {
  it("detects Hangul syllables only", () => {
    expect(containsHangul("설계도")).toBe(true);
    expect(containsHangul("Forma Blueprint")).toBe(false);
    expect(containsHangul("2X")).toBe(false);
  });

  it("folds the 0H misread of the AE syllable next to Hangul", () => {
    // Real Windows OCR read of a rendered reward name.
    expect(foldHangulLookalikes("0H쉬 프라임 시스템 설계도")).toBe("애쉬 프라임 시스템 설계도");
    expect(foldHangulLookalikes("쉬OH")).toBe("쉬애");
  });

  it("leaves quantity prefixes and Latin text alone", () => {
    expect(foldHangulLookalikes("2X 포르마 설계도")).toBe("2X 포르마 설계도");
    expect(foldHangulLookalikes("0H")).toBe("0H");
  });

  it("compacts a read to letters and digits without spaces", () => {
    expect(compactKoreanText(" 애쉬 프라임,  시스템\n설계도 ")).toBe("애쉬프라임시스템설계도");
    expect(compactKoreanText("2X 포르마 설계도")).toBe("2x포르마설계도");
  });

  it("splits syllables into jamo so a wrong final consonant costs one edit", () => {
    expect(toJamo("임")).toHaveLength(3);
    expect(toJamo("잉")).toHaveLength(3);
    expect([...toJamo("임")].filter((ch, i) => ch !== toJamo("잉")[i])).toHaveLength(1);
  });
});
