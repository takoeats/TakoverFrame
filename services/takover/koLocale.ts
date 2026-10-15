// The one switch for every Korean-client path (reward OCR, trade log): the game
// language set in the app. Kept apart from koRewardScan so the OCR engine can ask
// without importing the item database.

import { getGameLocale } from "../gameLocale";
import { containsHangul } from "./hangul";

export function isKoreanClient(): boolean {
  return getGameLocale() === "ko";
}

export function isKoreanRewardScan(): boolean {
  return isKoreanClient();
}

/** Windows OCR language list; null keeps the engine default (en-US). */
export function rewardOcrLanguages(): string[] | null {
  return isKoreanRewardScan() ? ["ko"] : null;
}

/** On the Korean client a one-syllable Hangul word is a name part, not OCR noise. */
export function keepsKoreanOcrToken(word: string): boolean {
  return isKoreanClient() && containsHangul(word);
}
