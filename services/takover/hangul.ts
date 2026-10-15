const HANGUL_SYLLABLE_RE = /[가-힣]/;

// Latin look-alikes Windows OCR emits for a whole Hangul syllable, taken from real
// reads. Only replaced next to Hangul so quantity prefixes such as "2X" survive.
const LOOKALIKE_SYLLABLES: ReadonlyArray<readonly [RegExp, string]> = [
  // "0H" for the syllable AE (U+C560): the circle initial read as a digit, the
  // vowel as an H.
  [/(?<=[가-힣])[0O]H|[0O]H(?=[가-힣])/g, "애"],
];

export function containsHangul(text: string): boolean {
  return HANGUL_SYLLABLE_RE.test(text);
}

export function foldHangulLookalikes(text: string): string {
  let out = text;
  for (const [pattern, syllable] of LOOKALIKE_SYLLABLES) out = out.replace(pattern, syllable);
  return out;
}

/**
 * The comparable core of a read: letters and digits only. Windows OCR splits and
 * merges Korean words freely, so spaces carry no signal and are dropped.
 */
export function compactKoreanText(text: string): string {
  return foldHangulLookalikes(String(text || "").normalize("NFC"))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Splits every syllable into its jamo (NFD). One wrong final consonant then costs
 * one edit of ~3 instead of a whole syllable, which is how OCR fails on Korean.
 */
export function toJamo(text: string): string {
  return text.normalize("NFD");
}
