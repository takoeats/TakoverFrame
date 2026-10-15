// Every Korean reward scan, saved the way scan-debug/ saves failed ones (strips
// only, no player names): a confident wrong match leaves nothing in scan-debug/.
// These feed the matcher tests; scripts/takover/ko-scan-report.cjs lists them.

import fs from "node:fs";
import path from "node:path";

import { normalizeErrorMessage } from "../../config/shared/errors";
import { withScope } from "../logger";
import {
  areOcrDebugDumpsEnabled,
  pruneScanDebugBundles,
  type ScanDebugSlot,
} from "../rewardScanDebug";
import type { SortedItem } from "../rewardScannerMatch";
import { userDataPath } from "../userDataPath";
import { compactKoreanText } from "./hangul";
import { koreanRewardNames, normalizeQuantityPrefix } from "./koRewardScan";

const log = withScope("koScanLog");

const MAX_BUNDLES = 300;
export const READ_SEPARATOR = " | ";

let dirOverride: string | null = null;
let sequence = 0;

export function setKoScanLogDirForTest(dir: string | null): void {
  dirOverride = dir;
}

function logDir(): string {
  return dirOverride ?? userDataPath("scan-log-ko");
}

function stampNow(): string {
  const d = new Date();
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}` +
    `_${p(++sequence % 100)}`
  );
}

function describeSlot(slot: ScanDebugSlot, sortedItems: SortedItem[]) {
  const item = slot.matchedName
    ? sortedItems.find((candidate) => candidate.name === slot.matchedName)
    : undefined;
  const names = item ? koreanRewardNames(item).map(compactKoreanText) : [];
  // Korean slots log every distinct read, joined by READ_SEPARATOR.
  const reads = slot.windowsText
    .split(READ_SEPARATOR)
    .map((read) => compactKoreanText(normalizeQuantityPrefix(read, read)))
    .filter(Boolean);
  return {
    slot: slot.index + 1,
    read: slot.windowsText,
    matchedName: slot.matchedName,
    matchedKo: (item && koreanRewardNames(item)[0]) ?? null,
    confidence: slot.confidence,
    mode: slot.mode,
    // The read spells out the name the scan reported (spacing and lookalikes aside).
    agrees: reads.some((read) => names.includes(read)),
  };
}

/** Saves one Korean scan: slot<N>.png strips and meta.json with reads and matches. */
export function logKoreanRewardScan(
  reason: string,
  slots: ScanDebugSlot[],
  meta: Record<string, unknown>,
  sortedItems: SortedItem[],
): void {
  if (!areOcrDebugDumpsEnabled() || slots.length === 0) return;
  try {
    const root = logDir();
    const dir = path.join(root, stampNow());
    fs.mkdirSync(dir, { recursive: true });
    for (const slot of slots) {
      if (slot.stripPng) {
        fs.writeFileSync(path.join(dir, `slot${slot.index + 1}.png`), Buffer.from(slot.stripPng));
      }
    }
    const described = slots.map((slot) => describeSlot(slot, sortedItems));
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({ reason, ...meta, slots: described }, null, 2),
      "utf8",
    );
    pruneScanDebugBundles(root, MAX_BUNDLES);
    for (const entry of described) {
      log.info(
        `[KoScan] slot ${entry.slot} read="${entry.read}" -> ${entry.matchedName ?? "-"}` +
          (entry.matchedName && !entry.agrees ? " (?)" : ""),
      );
    }
  } catch (err) {
    log.warn("[KoScan] log failed:", normalizeErrorMessage(err));
  }
}
