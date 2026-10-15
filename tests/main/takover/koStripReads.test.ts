import { describe, expect, it } from "vitest";

import { loadSharp } from "../../../services/sharpRuntime";
import { readKoreanStripInColor } from "../../../services/takover/koStripReads";

async function strip(width: number, height: number): Promise<Buffer> {
  return loadSharp()({
    create: { width, height, channels: 3, background: { r: 200, g: 170, b: 90 } },
  })
    .png()
    .toBuffer();
}

describe("Korean colour strip reads", () => {
  it("reads the strip as captured and at twice its width, without binarizing", async () => {
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
    expect(sent.map((s) => s.width).sort()).toEqual([315, 630]);
    expect(sent.every((s) => s.channels === 3)).toBe(true);
    expect(reads.sort()).toEqual(["라보스 임 새시 설계도 #1", "라보스 임 새시 설계도 #2"]);
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
    expect(reads).toEqual(["포르마 설계도"]);
  });
});
