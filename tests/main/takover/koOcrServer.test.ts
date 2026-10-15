import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

type FakeProc = EventEmitter & {
  stdout: EventEmitter & { setEncoding: (encoding: string) => void };
  stderr: EventEmitter;
  stdin: { write: (chunk: string) => void };
  killed: boolean;
  kill: () => void;
};

// The persistent ps1 helper: ready marker, then one JSON reply per request.
function serveRequests(requests: Record<string, unknown>[]): void {
  spawnMock.mockImplementation(() => {
    const proc = new EventEmitter() as FakeProc;
    proc.stdout = Object.assign(new EventEmitter(), { setEncoding: () => {} });
    proc.stderr = new EventEmitter();
    proc.killed = false;
    proc.kill = () => {
      proc.killed = true;
    };
    proc.stdin = {
      write: (chunk: string) => {
        const request = JSON.parse(chunk) as { id: string };
        requests.push(request);
        queueMicrotask(() => {
          proc.stdout.emit(
            "data",
            `${JSON.stringify({ id: request.id, ok: true, result: { text: "", lines: [] } })}\n`,
          );
        });
      },
    };
    queueMicrotask(() => proc.stdout.emit("data", "===OCR_SERVER_READY===\n"));
    return proc;
  });
}

const realPlatform = process.platform;

beforeEach(() => {
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  spawnMock.mockReset();
  vi.resetModules();
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

async function requestWithLocale(locale: string): Promise<Record<string, unknown>> {
  const { setGameLocale } = await import("../../../services/gameLocale");
  const { ocrServer } = await import("../../../services/ocrServer");
  setGameLocale(locale);
  const requests: Record<string, unknown>[] = [];
  serveRequests(requests);
  await ocrServer.runOCRStructured({ imageBase64: "eA==" }, 2000);
  ocrServer.dispose();
  return requests[0];
}

describe("PowerShell OCR server language", () => {
  it("asks for Korean on a Korean client", async () => {
    expect(await requestWithLocale("ko")).toMatchObject({ lang: "ko" });
  });

  it("leaves the language out on an English client", async () => {
    expect(await requestWithLocale("en")).not.toHaveProperty("lang");
  });
});
