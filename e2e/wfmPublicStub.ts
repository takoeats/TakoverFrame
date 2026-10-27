import type { ElectronApplication } from "@playwright/test";

import { WFM_PUBLIC_GET } from "../config/shared/ipcChannels";
import { evaluateInMain } from "./electronTestHarness";

/** What the renderer's public WFM reads answer with. A lookup left out goes to
 *  the real client, as an unstubbed fetch used to. */
export interface WfmPublicFixture {
  /** One book for every slug, or books by slug where a missing slug is empty. */
  orders?: unknown[] | Record<string, unknown[]>;
  /** The v2 item `data`. */
  item?: unknown;
  /** The whole v1 statistics body. */
  statistics?: unknown;
  /** Orders read as unanswered, the way main reports a failed request. */
  ordersOffline?: boolean;
}

/** Replaces main's `wfm:public-get` handler. Renderer reads go through main now,
 *  so a page-side fetch stub no longer sees them. */
export async function stubWfmPublicGet(
  app: ElectronApplication,
  fixture: WfmPublicFixture,
): Promise<void> {
  await evaluateInMain(
    app,
    ({ app, ipcMain }, { channel, fixture }) => {
      const scope = globalThis as typeof globalThis & { wfmPublicFixture?: WfmPublicFixture };
      scope.wfmPublicFixture = fixture;
      const load = process
        .getBuiltinModule("module")
        .createRequire(`${app.getAppPath()}/.electron-build/main.js`);
      const client = load("./services/wfmClient.js") as typeof import("../services/wfmClient");
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, (_event, request: { lookup: string; slug: string }) => {
        const current = scope.wfmPublicFixture ?? {};
        const { lookup, slug } = request;
        if (lookup === "orders" && current.ordersOffline) return { status: null, body: null };
        if (lookup === "orders" && current.orders !== undefined) {
          const books = current.orders;
          const data = Array.isArray(books) ? books : (books[slug] ?? []);
          return { status: 200, body: { data } };
        }
        if (lookup === "item" && current.item !== undefined) {
          return { status: 200, body: { data: current.item } };
        }
        if (lookup === "statistics" && current.statistics !== undefined) {
          return { status: 200, body: current.statistics };
        }
        if (lookup === "orders") return client.requestPublicGet("v2", `/orders/item/${slug}`);
        if (lookup === "item") return client.requestPublicGet("v2", `/items/${slug}`);
        return client.requestPublicGet("v1", `/items/${slug}/statistics`);
      });
    },
    { channel: WFM_PUBLIC_GET, fixture },
  );
}

/** Changes the installed fixture mid-test. */
export async function patchWfmPublicFixture(
  app: ElectronApplication,
  patch: WfmPublicFixture,
): Promise<void> {
  await evaluateInMain(
    app,
    (_electron, patch) => {
      const scope = globalThis as typeof globalThis & { wfmPublicFixture?: WfmPublicFixture };
      scope.wfmPublicFixture = { ...scope.wfmPublicFixture, ...patch };
    },
    patch,
  );
}
