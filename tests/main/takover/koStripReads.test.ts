import { describe, expect, it } from "vitest";

import { loadSharp } from "../../../services/sharpRuntime";
import {
  goldMask,
  joinWrappedLines,
  KOREAN_STRIP_READS,
  readKoreanStripInColor,
} from "../../../services/takover/koStripReads";

async function strip(width: number, height: number): Promise<Buffer> {
  return loadSharp()({
    create: { width, height, channels: 3, background: { r: 200, g: 170, b: 90 } },
  })
    .png()
    .toBuffer();
}

describe("Korean colour strip reads", () => {
  it("reads the strip as captured, at twice its width and gold-masked", async () => {
    const png = await strip(315, 59);
    const sent: Array<{ width?: number; channels?: number }> = [];
    const reads = await readKoreanStripInColor(
      png,
      async (buffer) => {
        const meta = await loadSharp()(buffer).metadata();
        sent.push({ width: meta.width, channels: meta.channels });
        return { text: `  라보스  임 새시 설계도 #${sent.length}` } as never;
      },
      1000,
    );
    expect(sent).toHaveLength(KOREAN_STRIP_READS);
    expect(sent.map((s) => s.width).sort()).toEqual([315, 355, 630]);
    expect(sent.find((s) => s.width === 355)?.channels).toBe(1);
    expect(reads.sort()).toEqual([
      "라보스 임 새시 설계도 #1",
      "라보스 임 새시 설계도 #2",
      "라보스 임 새시 설계도 #3",
    ]);
  });

  it("keeps the gold name and drops the grey art behind it", async () => {
    const sharp = loadSharp();
    const grey = { r: 150, g: 150, b: 140 };
    const gold = { r: 220, g: 180, b: 90 };
    const png = await sharp({ create: { width: 40, height: 10, channels: 3, background: grey } })
      .composite([
        {
          input: await sharp({ create: { width: 20, height: 10, channels: 3, background: gold } })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();
    const mask = await goldMask(png);
    const { data, info } = await sharp(mask!).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => data[((y + 20) * info.width + x + 20) * info.channels];
    expect(info.width).toBe(80);
    expect(at(5, 5)).toBe(0);
    expect(at(30, 5)).toBe(255);
    expect(data[0]).toBe(255);
  });

  it("drops a read that fails instead of failing the slot", async () => {
    const png = await strip(315, 59);
    let calls = 0;
    const reads = await readKoreanStripInColor(
      png,
      async () => {
        calls += 1;
        if (calls === 1) throw new Error("ocr timeout");
        return { text: "포르마 설계도" } as never;
      },
      1000,
    );
    expect(calls).toBe(KOREAN_STRIP_READS);
    expect(reads).toEqual(["포르마 설계도", "포르마 설계도"]);
  });

  describe("wrapped lines", () => {
    // Ink as "#" rows; the mask stores ink as 0.
    function mask(rows: string[]) {
      const width = rows[0].length;
      const data = Buffer.from(
        rows
          .join("")
          .split("")
          .map((c) => (c === "#" ? 0 : 255)),
      );
      return { data, width, height: rows.length };
    }
    const line = (ink: string) => ink.padEnd(60, ".");

    it("lays the second line after the first, bottom-aligned", () => {
      const first = "#".repeat(40);
      const second = "#".repeat(20);
      const rows = [line(first), line(first), line(first), line(""), line(""), line(second)];
      rows.push(line(second));
      while (rows.length < 10) rows.push(line(""));
      const joined = joinWrappedLines(mask(rows));
      expect(joined).not.toBeNull();
      expect(joined!.width).toBe(40 + 12 + 20);
      expect(joined!.height).toBe(3);
      const bottom = joined!.data.subarray(2 * joined!.width, 3 * joined!.width);
      expect(bottom[0]).toBe(0);
      expect(bottom[40 + 12]).toBe(0);
      // The shorter second line sits on the baseline, not at the top.
      expect(joined!.data[40 + 12]).toBe(255);
    });

    it("leaves a single line alone", () => {
      const rows = Array.from({ length: 10 }, () => line("#".repeat(40)));
      expect(joinWrappedLines(mask(rows))).toBeNull();
    });

    it("does not take art speckle under one line for a second line", () => {
      const rows = [
        line("#".repeat(40)),
        line("#".repeat(40)),
        line(""),
        line(""),
        line(""),
        line(""),
      ];
      rows.push(line("#".repeat(5)), line(""), line(""), line(""));
      expect(joinWrappedLines(mask(rows))).toBeNull();
    });
  });
});
