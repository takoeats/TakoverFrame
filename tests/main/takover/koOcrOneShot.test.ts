import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

vi.mock("child_process", () => ({ execFile: execFileMock }));
// Native OCR missing and the persistent server down: the one-shot script runs.
vi.mock("../../../services/ocrServer", () => ({
  nativeOcrAvailable: false,
  ocrServer: { runOCR: () => Promise.reject(new Error("server down")) },
  getWindowsOcrHealth: () => ({ available: true, reason: null }),
}));

import { setGameLocale } from "../../../services/gameLocale";
import { createRewardOcrRunner } from "../../../services/rewardScannerOcr";

async function oneShotArgs(locale: string): Promise<string[]> {
  setGameLocale(locale);
  execFileMock.mockImplementation((_cmd, _args, _opts, done) => done(null, "", ""));
  await createRewardOcrRunner({ ocrScriptPath: "ocr.ps1" }).runPowerShellOCR("crop.png", 1000);
  return execFileMock.mock.calls.at(-1)?.[1] as string[];
}

afterEach(() => {
  setGameLocale("en");
  execFileMock.mockReset();
});

describe("one-shot PowerShell OCR language", () => {
  it("passes -Lang ko on a Korean client", async () => {
    expect((await oneShotArgs("ko")).slice(-3)).toEqual(["crop.png", "-Lang", "ko"]);
  });

  it("keeps the script's English default otherwise", async () => {
    expect(await oneShotArgs("en")).not.toContain("-Lang");
  });
});
