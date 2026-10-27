import { vi } from "vitest";

import type { WfmPublicGetRequest, WfmPublicGetResponse } from "../../../../config/shared/wfm.js";

const API = "https://api.warframe.market";

function urlFor({ lookup, slug }: WfmPublicGetRequest): string {
  if (lookup === "orders") return `${API}/v2/orders/item/${slug}`;
  if (lookup === "item") return `${API}/v2/items/${slug}`;
  return `${API}/v1/items/${slug}/statistics`;
}

/** Answers the renderer's `wfmPublicGet` IPC through `globalThis.fetch` at the
 *  URL main would call, so specs keep scripting WFM per URL. A rejected fetch or
 *  an unreadable body comes back as `status: null`, as it does from main. */
export function stubWfmPublicGetViaFetch(): ReturnType<typeof vi.fn> {
  const wfmPublicGet = vi.fn(async (request: WfmPublicGetRequest) => {
    const empty: WfmPublicGetResponse = { status: null, body: null };
    try {
      const res = await globalThis.fetch(urlFor(request));
      return { status: res.status, body: res.ok ? await res.json() : null };
    } catch {
      return empty;
    }
  });
  vi.stubGlobal("window", { api: { wfmPublicGet } });
  return wfmPublicGet;
}
