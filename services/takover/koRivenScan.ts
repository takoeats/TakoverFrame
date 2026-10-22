// Korean riven card reads. The bundled PaddleOCR model has no Hangul, so the
// Korean client reads the stat area with Windows OCR and hands the riven parser
// the English card text.

import { withScope } from "../logger";
import { nativeOcrAvailable, nativeOcrBuffer, ocrServer } from "../ocrServer";
import type { RivenOcrResult } from "../rivenOcrOnnx";
import { loadSharp } from "../sharpRuntime";
import { koreanRivenTextToEnglish } from "./koRivenText";

const log = withScope("koRivenScan");

const OCR_TIMEOUT_MS = 5000;

async function readPng(png: Buffer): Promise<string> {
  if (nativeOcrAvailable) return nativeOcrBuffer(png, OCR_TIMEOUT_MS);
  return ocrServer.runOCRBuffer(png, OCR_TIMEOUT_MS);
}

/** Same shape as recognizeStatArea; Windows OCR gives no confidence, so lines count as sure. */
export async function recognizeKoreanStatArea(
  rgba: Buffer,
  width: number,
  height: number,
): Promise<RivenOcrResult> {
  const png = await loadSharp()(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  const raw = await readPng(png);
  log.info(`[RivenScan] Korean read: "${raw.replace(/\s+/g, " ").trim()}"`);
  const text = koreanRivenTextToEnglish(raw);
  const lines = text ? text.split("\n").map((line) => ({ text: line, confidence: 1 })) : [];
  return { lines, text, minConfidence: lines.length > 0 ? 1 : -1, yoloBoxCount: 0 };
}
