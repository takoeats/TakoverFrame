import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const { titleRects } = createRequire(__filename)(
  "../../../scripts/takover/crop-reward-titles.cjs",
) as {
  titleRects: (
    width: number,
    height: number,
    players: number,
    uiScalePercent?: number,
  ) => Array<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    cardTop: number;
  }>;
};

describe("reward title crop geometry", () => {
  it("lands on upstream's 1080p four-player title crops", () => {
    // scripts/reward-scan-e2e/fixtures/slot-crops/4_players_slot<i>_title_<x>x413_234x44.png
    const rects = titleRects(1920, 1080, 4, 99);
    expect(rects.map((r) => r.x)).toEqual([470, 714, 958, 1202]);
    expect(rects.every((r) => r.y === 413 && r.height === 44)).toBe(true);
    expect(rects.every((r) => Math.abs(r.width - 234) <= 1)).toBe(true);
  });

  it("puts the card top where upstream's 1080p scaffold does", () => {
    // build-screens.cjs SLOT_Y
    expect(titleRects(1920, 1080, 3, 99).every((r) => r.cardTop === 243)).toBe(true);
  });

  it("scales a 1440p frame by height", () => {
    const [first] = titleRects(2560, 1440, 4, 99);
    expect(first).toMatchObject({ x: 627, y: 551, height: 58 });
    expect(Math.abs(first.width - 312)).toBeLessThanOrEqual(1);
  });

  it("keeps the cards 16:9 inside a taller frame", () => {
    const wide = titleRects(1920, 1080, 2, 99);
    const tall = titleRects(1920, 1200, 2, 99);
    expect(tall.map((r) => r.x)).toEqual(wide.map((r) => r.x));
    expect(tall[0].y - wide[0].y).toBe(60);
  });

  it("shrinks toward the centre at a smaller interface scale", () => {
    const [full] = titleRects(1920, 1080, 1, 99);
    const [small] = titleRects(1920, 1080, 1, 50);
    expect(small.width).toBeLessThan(full.width);
    expect(Math.abs(small.x + small.width / 2 - (full.x + full.width / 2))).toBeLessThanOrEqual(1);
  });
});
