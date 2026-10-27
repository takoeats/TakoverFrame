import { describe, expect, it, vi } from "vitest";

const constructed: unknown[][] = [];

vi.mock("electron", () => ({
  app: { getVersion: () => "1.2.3" },
}));

vi.mock("ws", () => {
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    constructor(...args: unknown[]) {
      constructed.push(args);
    }
  }
  return { default: FakeWebSocket };
});

import { APP_HOMEPAGE_URL, APP_PRODUCT_NAME } from "../../config/shared/appMeta";
import { createWfmWebSocket } from "../../services/wfmWebSocketCommon";

describe("createWfmWebSocket", () => {
  it("names the app in the handshake User-Agent", () => {
    createWfmWebSocket();
    const options = constructed.at(-1)?.[2] as { headers?: Record<string, string> };
    expect(options.headers?.["User-Agent"]).toBe(
      `${APP_PRODUCT_NAME}/1.2.3 (+${APP_HOMEPAGE_URL})`,
    );
  });
});
