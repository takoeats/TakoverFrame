import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { setGameLocale } from "../../../services/gameLocale";
import * as itemDb from "../../../services/itemDatabase";
import { getRelicRewardItems } from "../../../services/relicService";
import { setOcrDebugDumpsEnabled, type ScanDebugSlot } from "../../../services/rewardScanDebug";
import { logKoreanRewardScan, setKoScanLogDirForTest } from "../../../services/takover/koScanLog";

let rewards: ReturnType<typeof getRelicRewardItems>;
let dir: string;

beforeAll(() => {
  itemDb.buildDatabase();
  setGameLocale("ko");
  rewards = getRelicRewardItems();
});

afterAll(() => {
  setGameLocale("en");
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "takover-ko-scan-log-"));
  setKoScanLogDirForTest(dir);
  setOcrDebugDumpsEnabled(true);
});

afterEach(() => {
  setKoScanLogDirForTest(null);
  setOcrDebugDumpsEnabled(false);
  fs.rmSync(dir, { recursive: true, force: true });
});

function slot(index: number, windowsText: string, matchedName: string | null): ScanDebugSlot {
  return {
    index,
    stripPng: Buffer.from([index]),
    windowsText,
    onnxText: "",
    diverged: false,
    matchedName,
    confidence: matchedName ? 1 : null,
    mode: matchedName ? "exact" : null,
  };
}

function onlyBundle(): string {
  const entries = fs.readdirSync(dir);
  expect(entries).toHaveLength(1);
  return path.join(dir, entries[0]);
}

describe("Korean reward scan log", () => {
  it("keeps every scan's strips and reads, successful ones too", () => {
    logKoreanRewardScan(
      "matched",
      [slot(0, "패리스 프라임 스트링", "Paris Prime String"), slot(1, "", null)],
      { layoutCount: 2 },
      rewards,
    );

    const bundle = onlyBundle();
    expect(fs.readdirSync(bundle).sort()).toEqual(["meta.json", "slot1.png", "slot2.png"]);
    const meta = JSON.parse(fs.readFileSync(path.join(bundle, "meta.json"), "utf8"));
    expect(meta).toMatchObject({ reason: "matched", layoutCount: 2 });
    expect(meta.slots[0]).toMatchObject({
      read: "패리스 프라임 스트링",
      matchedName: "Paris Prime String",
      matchedKo: "패리스 프라임 스트링",
      agrees: true,
    });
    expect(meta.slots[1]).toMatchObject({ read: "", matchedName: null, agrees: false });
  });

  it("flags a match whose Korean name is not what was read", () => {
    // The real misread before the count fix: a counted forma reported as a single one.
    logKoreanRewardScan("matched", [slot(0, "2ⅹ포르마 설계도", "Forma Blueprint")], {}, rewards);
    const meta = JSON.parse(fs.readFileSync(path.join(onlyBundle(), "meta.json"), "utf8"));
    expect(meta.slots[0]).toMatchObject({ matchedKo: "포르마 설계도", agrees: false });

    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    logKoreanRewardScan("matched", [slot(0, "2ⅹ포르마 설계도", "2X Forma Blueprint")], {}, rewards);
    const fixed = JSON.parse(fs.readFileSync(path.join(onlyBundle(), "meta.json"), "utf8"));
    expect(fixed.slots[0].agrees).toBe(true);
  });

  it("agrees when any of a slot's reads spells the reported name", () => {
    // Korean slots log every read: binarized bands, then the colour strip.
    logKoreanRewardScan(
      "matched",
      [slot(0, "포르마쬗계도 | 포르마 설계도", "Forma Blueprint")],
      {},
      rewards,
    );
    const meta = JSON.parse(fs.readFileSync(path.join(onlyBundle(), "meta.json"), "utf8"));
    expect(meta.slots[0].agrees).toBe(true);
  });

  it("writes nothing while OCR debug dumps are off", () => {
    setOcrDebugDumpsEnabled(false);
    logKoreanRewardScan("matched", [slot(0, "포르마 설계도", "Forma Blueprint")], {}, rewards);
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
