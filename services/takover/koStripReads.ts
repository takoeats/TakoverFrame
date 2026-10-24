// Colour strip reads for the Korean client. Item art behind a two-line name breaks
// the binarized bands; Windows OCR does better on the colour strip, and better still
// on a gold mask (the art is grey) with the two lines side by side, since it drops a
// short second line read on its own.

import { loadSharp } from "../sharpRuntime";

type StructuredOcrRunner = (buffer: Buffer, timeoutMs: number) => Promise<{ text?: string } | null>;

const UPSCALE = 2;
// Measured on name strips: 40 to 80 all read the same, so this sits mid-range.
const GOLD_RED_OVER_BLUE = 60;
const GOLD_MIN_RED = 110;
// Windows OCR drops glyphs that touch the image edge.
const MASK_MARGIN = 20;
// The blank row between wrapped lines; first-line descenders may leave a few dots.
const LINE_GAP_BAND = [0.35, 0.65] as const;
const LINE_GAP_MAX_INK = 3;
// Fewer gold pixels than this below the gap is art speckle, not a line.
const MIN_LINE_INK = 30;
// About one space at the strip's glyph size.
const JOINED_LINE_SPACING = 12;

/** Number of OCR calls readKoreanStripInColor makes per strip. */
export const KOREAN_STRIP_READS = 3;

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

async function upscale(stripPng: Buffer): Promise<Buffer | null> {
  try {
    const sharp = loadSharp();
    const { width } = await sharp(stripPng).metadata();
    if (!width) return null;
    return await sharp(stripPng)
      .resize({ width: width * UPSCALE, kernel: "lanczos3" })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

type Mask = { data: Buffer; width: number; height: number };
type Box = { left: number; top: number; right: number; bottom: number; ink: number };

function inkBox(mask: Mask, fromRow: number, toRow: number): Box | null {
  let box: Box | null = null;
  for (let y = fromRow; y < toRow; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x] !== 0) continue;
      if (!box) box = { left: x, top: y, right: x, bottom: y, ink: 0 };
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
      box.ink++;
    }
  }
  return box;
}

function inkInRow(mask: Mask, y: number): number {
  let ink = 0;
  for (let x = 0; x < mask.width; x++) if (mask.data[y * mask.width + x] === 0) ink++;
  return ink;
}

/** A wrapped name's two lines laid side by side, bottom-aligned; null for one line. */
export function joinWrappedLines(mask: Mask): Mask | null {
  let gap = -1;
  let gapInk = Infinity;
  const [from, to] = LINE_GAP_BAND;
  for (let y = Math.floor(mask.height * from); y < Math.ceil(mask.height * to); y++) {
    const ink = inkInRow(mask, y);
    if (ink < gapInk) {
      gap = y;
      gapInk = ink;
    }
  }
  if (gap < 0 || gapInk > LINE_GAP_MAX_INK) return null;
  const first = inkBox(mask, 0, gap);
  const second = inkBox(mask, gap + 1, mask.height);
  if (!first || !second || first.ink < MIN_LINE_INK || second.ink < MIN_LINE_INK) return null;

  const firstWidth = first.right - first.left + 1;
  const secondWidth = second.right - second.left + 1;
  const firstHeight = first.bottom - first.top + 1;
  const secondHeight = second.bottom - second.top + 1;
  const width = firstWidth + JOINED_LINE_SPACING + secondWidth;
  const height = Math.max(firstHeight, secondHeight);
  const data = Buffer.alloc(width * height, 255);
  const paste = (box: Box, boxWidth: number, boxHeight: number, offsetX: number) => {
    const offsetY = height - boxHeight;
    for (let y = 0; y < boxHeight; y++) {
      for (let x = 0; x < boxWidth; x++) {
        data[(offsetY + y) * width + offsetX + x] =
          mask.data[(box.top + y) * mask.width + box.left + x];
      }
    }
  };
  paste(first, firstWidth, firstHeight, 0);
  paste(second, secondWidth, secondHeight, firstWidth + JOINED_LINE_SPACING);
  return { data, width, height };
}

/** Gold pixels black on white, a wrapped name joined into one line. */
export async function goldMask(stripPng: Buffer): Promise<Buffer | null> {
  try {
    const sharp = loadSharp();
    const { data, info } = await sharp(stripPng)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    const mask: Mask = { data: Buffer.alloc(pixels), width: info.width, height: info.height };
    for (let p = 0; p < pixels; p++) {
      const red = data[p * info.channels];
      const blue = data[p * info.channels + 2];
      mask.data[p] = red > GOLD_MIN_RED && red - blue > GOLD_RED_OVER_BLUE ? 0 : 255;
    }
    const laid = joinWrappedLines(mask) ?? mask;
    return await sharp(laid.data, { raw: { width: laid.width, height: laid.height, channels: 1 } })
      .extend({
        top: MASK_MARGIN,
        bottom: MASK_MARGIN,
        left: MASK_MARGIN,
        right: MASK_MARGIN,
        background: "white",
      })
      .toColourspace("b-w")
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/** OCR texts of the colour strip, as captured, upscaled and gold-masked; failed reads are dropped. */
export async function readKoreanStripInColor(
  stripPng: Buffer,
  run: StructuredOcrRunner,
  timeoutMs: number,
): Promise<string[]> {
  const [upscaled, masked] = await Promise.all([upscale(stripPng), goldMask(stripPng)]);
  const reads = await Promise.all([
    read(stripPng, run, timeoutMs),
    upscaled ? read(upscaled, run, timeoutMs) : Promise.resolve(""),
    masked ? read(masked, run, timeoutMs) : Promise.resolve(""),
  ]);
  return reads.filter(Boolean);
}
