// Colour strip reads for the Korean client. With item art behind a two-line name,
// binarizing a band merges art and glyphs and every band reads as noise; Windows
// OCR reads the same strip in colour far better, as captured or at twice the width.

import { loadSharp } from "../sharpRuntime";

type StructuredOcrRunner = (buffer: Buffer, timeoutMs: number) => Promise<{ text?: string } | null>;

const UPSCALE = 2;

async function read(buffer: Buffer, run: StructuredOcrRunner, timeoutMs: number): Promise<string> {
  try {
    const result = await run(buffer, timeoutMs);
    return String(result?.text || "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

/** OCR texts of the colour strip, as captured and upscaled; failed reads are dropped. */
export async function readKoreanStripInColor(
  stripPng: Buffer,
  run: StructuredOcrRunner,
  timeoutMs: number,
): Promise<string[]> {
  let upscaled: Buffer | null = null;
  try {
    const sharp = loadSharp();
    const { width } = await sharp(stripPng).metadata();
    if (width) {
      upscaled = await sharp(stripPng)
        .resize({ width: width * UPSCALE, kernel: "lanczos3" })
        .png()
        .toBuffer();
    }
  } catch {
    upscaled = null;
  }
  const reads = await Promise.all([
    read(stripPng, run, timeoutMs),
    upscaled ? read(upscaled, run, timeoutMs) : Promise.resolve(""),
  ]);
  return reads.filter(Boolean);
}
