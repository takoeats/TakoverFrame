import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RELIC_RECOMMENDATIONS } from "../../../config/shared/ipcChannels";
import type { OverlaySettings } from "../../../config/runtime/overlaySettings";
import { createRelicSelectionController } from "../../../ipc/overlay/relicSelection";
import { squadOnlyPush } from "../../../services/takover/overlaySquad";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("squadOnlyPush", () => {
  it("takes a lone valid squadSize only", () => {
    expect(squadOnlyPush({ squadSize: 1 })).toBe(1);
    expect(squadOnlyPush({ squadSize: 4 })).toBe(4);
    for (const raw of [
      { squadSize: 0 },
      { squadSize: 5 },
      { squadSize: 2.5 },
      { squadSize: "1" },
      { squadSize: 1, sortMode: "name" },
      [1],
      null,
      1,
    ]) {
      expect(squadOnlyPush(raw)).toBeNull();
    }
  });
});

describe("relic overlay squad size", () => {
  // Two even rewards worth 10 and 0: solo EV 5, four players 10 * (1 - 0.5^4).
  function makeController() {
    const relic = "/Lotus/Types/Game/Projections/LithTestIntact";
    const rewards = [10, 0].map((price, index) => ({
      name: `Reward ${index}`,
      uniqueName: null,
      imageUrl: null,
      urlName: `reward_${price}`,
      chance: 50,
      ducats: price,
      rarity: "Common",
    }));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "takover-overlay-squad-"));
    tempDirs.push(dir);
    const cacheFilePath = path.join(dir, "snapshot-cache.json");
    fs.writeFileSync(cacheFilePath, "{}", "utf-8");
    const events: unknown[] = [];
    const controller = createRelicSelectionController({
      eraStartDelayMs: 0,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      ctx: {
        overlaySettings: { autoTriggerEnabled: true } as OverlaySettings,
        currentInventoryData: { LevelKeys: [{ ItemType: relic, ItemCount: 1 }] },
      },
      windows: {
        createOverlayWindow: vi.fn(),
        clearOverlayAutoHideTimer: vi.fn(),
        scheduleOverlayAutoHide: vi.fn(),
        sendOverlayEvent: (channel, payload) => {
          if (channel === RELIC_RECOMMENDATIONS) events.push(payload);
        },
        positionOverlayWindow: vi.fn(),
        getAnchorMeta: () => null,
        setAnchorMeta: vi.fn(),
      },
      relicService: {
        getRelicDatabase: () => ({
          groups: {
            test: {
              key: "test",
              name: "Lith Test",
              tier: "Lith",
              qualities: { intact: { rewards } },
            },
          },
          byUniqueName: { [relic]: { groupKey: "test", quality: "intact" } },
        }),
      },
      rewardScanner: { detectRelicSelectionEra: async () => ({ era: "Lith", confidence: 1 }) },
      wfmStatsPrice: {
        getCachedPriceBySlug: (slug: string) => (slug === "reward_10" ? 10 : 0),
      },
      fs,
      cacheFilePath,
    });
    const platEv = async () => {
      await controller.onRelicSelectionTrigger("manual");
      await new Promise((resolve) => setTimeout(resolve, 10));
      return (events.at(-1) as { rows: Array<{ platEv: number | null }> }).rows[0].platEv;
    };
    return { controller, platEv };
  }

  it("starts at four players and follows a squad-only push", async () => {
    const { controller, platEv } = makeController();
    expect(await platEv()).toBeCloseTo(9.375);

    controller.setDesktopFilters({ squadSize: 1 });
    expect(await platEv()).toBeCloseTo(5);
  });
});
