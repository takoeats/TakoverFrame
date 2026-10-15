// Windows OCR reads Korean only with the Korean OCR language feature installed.
// Without it every crop fails and the overlay blames the capture; one probe turns
// that into the "OCR unavailable" path, which tells the player what to install.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { normalizeErrorMessage } from "../../config/shared/errors";
import { withScope } from "../logger";
import { rewardOcrLanguages } from "./koLocale";

const log = withScope("koOcr");

type Recognize = (
  input: string,
  accuracy?: number | null,
  preferredLangs?: string[] | null,
) => Promise<unknown>;

// 16x16 white PNG. The native addon takes a path; its buffer overload is unsafe.
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAD0lEQVR42mP4jwYYRrYAAID5/wGR6yAaAAAAAElFTkSuQmCC",
  "base64",
);

let probe: Promise<void> | null = null;
let missingReason: string | null = null;

async function runProbe(recognize: Recognize): Promise<void> {
  const file = path.join(os.tmpdir(), `takoverframe-ko-probe-${process.pid}.png`);
  try {
    await fs.promises.writeFile(file, BLANK_PNG);
    let koError: string;
    try {
      await recognize(file, null, ["ko"]);
      return;
    } catch (err) {
      koError = normalizeErrorMessage(err, "unknown error");
    }
    // A default-language failure is the whole engine, already reported as such.
    try {
      await recognize(file, null, null);
    } catch {
      return;
    }
    missingReason = `Korean OCR language is not installed (${koError})`;
    log.warn(
      `${missingReason} - install Korean with its optical character recognition feature ` +
        `(Windows Settings > Time & Language > Language), then restart TakoverFrame`,
    );
  } catch (err) {
    log.warn("Korean OCR probe could not run:", normalizeErrorMessage(err, "unknown error"));
  } finally {
    await fs.promises.rm(file, { force: true }).catch(() => undefined);
  }
}

/** rewardOcrLanguages() for the native engine; checks once that it can read Korean. */
export function nativeRewardOcrLanguages(recognize: Recognize): string[] | null {
  const languages = rewardOcrLanguages();
  if (languages) probe ??= runProbe(recognize);
  return languages;
}

/** Language for the PowerShell OCR fallbacks; null keeps their English default. */
export function powerShellRewardOcrLanguage(): string | null {
  return rewardOcrLanguages()?.[0] ?? null;
}

/** Why Korean reward scans cannot work on this PC, or null. Restart re-probes. */
export function koreanOcrMissingReason(): string | null {
  return rewardOcrLanguages() ? missingReason : null;
}

export function settleKoreanOcrProbeForTest(): Promise<void> {
  return probe ?? Promise.resolve();
}

export function resetKoreanOcrProbeForTest(): void {
  probe = null;
  missingReason = null;
}
