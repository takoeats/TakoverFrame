import { normalizeWfmSlug } from "../../../config/shared/wfm.js";
import { isCacheEntryFresh, normalizeRank } from "../../../config/shared/numeric.js";
import { rendererOrderBookCacheKey } from "../../../config/shared/wfmCacheKeys.js";
import {
  extractWfmOrderList,
  normalizeSubtype,
  normalizeWfmOrderBookSide,
  type WfmOrderBookEntry,
} from "../../../config/shared/wfmOrders.js";
import { invoke } from "../ipc.js";
import { createPriorityRequestQueue } from "./requestPolicy.js";
import { log } from "../log.js";

export type OrderBookEntry = WfmOrderBookEntry;

export interface ItemOrderBook {
  slug: string;
  sell: OrderBookEntry[];
  buy: OrderBookEntry[];
  timestamp: number;
}

type ItemOrderBookResult =
  | { status: "ok"; data: ItemOrderBook }
  | { status: "not_found"; slug: string }
  | { status: "error"; slug: string };

const ORDERBOOK_TTL_MS = 45_000;
const ORDERBOOK_NO_DATA_TTL_MS = 3 * 60 * 1000;
const orderBookQueue = createPriorityRequestQueue({
  priorities: ["interactive", "background"] as const,
  maxConcurrent: 4,
  maxDepth: Number.MAX_SAFE_INTEGER,
});

interface OrderBookDebugCounters {
  requests: number;
  cacheHitOk: number;
  cacheHitNoData: number;
  httpCalls: number;
  resultOk: number;
  resultNoData: number;
  resultError: number;
}

type CacheEntry =
  | { status: "ok"; data: ItemOrderBook; cachedAt: number }
  | { status: "not_found"; cachedAt: number };

const cacheBySlug = new Map<string, CacheEntry>();
const inFlightBySlug = new Map<string, { owner: symbol; promise: Promise<ItemOrderBookResult> }>();
const generationBySlug = new Map<string, number>();
let clearGeneration = 0;

const orderBookDebugCounters: OrderBookDebugCounters = {
  requests: 0,
  cacheHitOk: 0,
  cacheHitNoData: 0,
  httpCalls: 0,
  resultOk: 0,
  resultNoData: 0,
  resultError: 0,
};

function bumpCounter(counter: keyof OrderBookDebugCounters): void {
  orderBookDebugCounters[counter] += 1;
}

function isFresh(entry: CacheEntry): boolean {
  return isCacheEntryFresh(entry, ORDERBOOK_TTL_MS, ORDERBOOK_NO_DATA_TTL_MS, {
    timestampKey: "cachedAt",
  });
}

async function fetchRawOrders(
  slug: string,
  background: boolean,
): Promise<{ data: unknown[] | null; transient: boolean }> {
  bumpCounter("httpCalls");
  try {
    const response = await invoke("wfmPublicGet", { lookup: "orders", slug, background });
    if (response.status === null || response.status === 429 || response.status >= 500) {
      return { data: null, transient: true };
    }
    if (response.status < 200 || response.status >= 300) return { data: null, transient: false };
    return { data: extractWfmOrderList(response.body), transient: false };
  } catch {
    return { data: null, transient: true };
  }
}

// v1 /items/{slug}/orders answers 403 "Deprecated", so v2 is the only source.
async function fetchDirectOrderBook(
  slug: string,
  rank: number | null,
  subtype: string | null,
  background: boolean,
): Promise<ItemOrderBookResult> {
  const attempt = await fetchRawOrders(slug, background);
  if (attempt.data) {
    bumpCounter("resultOk");
    // A 200 with no orders is what an "empty listing" report looks like; keep the trace.
    if (attempt.data.length === 0) log.warn(`[OrderBook] v2 returned no orders for ${slug}`);
    return {
      status: "ok",
      data: {
        slug,
        // Renderer keeps the FULL book - the browse tab pages through it; the
        // default 500 cap is for the worker's KV-bound prewarm path only.
        sell: normalizeWfmOrderBookSide(
          attempt.data,
          "sell",
          rank,
          Number.MAX_SAFE_INTEGER,
          subtype,
        ),
        buy: normalizeWfmOrderBookSide(attempt.data, "buy", rank, Number.MAX_SAFE_INTEGER, subtype),
        timestamp: Date.now(),
      },
    };
  }
  bumpCounter(attempt.transient ? "resultError" : "resultNoData");
  return attempt.transient ? { status: "error", slug } : { status: "not_found", slug };
}

export function resetOrderBookDebugCounters(): void {
  for (const key of Object.keys(orderBookDebugCounters) as Array<keyof OrderBookDebugCounters>) {
    orderBookDebugCounters[key] = 0;
  }
}

function subtypedCacheKey(slug: string, rank: number | null, subtype: string | null): string {
  const base = rendererOrderBookCacheKey(slug, rank);
  return subtype ? `${base}:st-${subtype}` : base;
}

export function clearOrderBookCache(
  slug?: string | null,
  rank?: number | null,
  subtype?: string | null,
): void {
  const normalizedSlug = normalizeWfmSlug(slug);
  if (!normalizedSlug) {
    clearGeneration += 1;
    cacheBySlug.clear();
    inFlightBySlug.clear();
    generationBySlug.clear();
    return;
  }

  const normalizedRank = normalizeRank(rank);
  const key = subtypedCacheKey(normalizedSlug, normalizedRank, normalizeSubtype(subtype));
  cacheBySlug.delete(key);
  inFlightBySlug.delete(key);
  generationBySlug.set(key, (generationBySlug.get(key) ?? 0) + 1);
}

export async function fetchItemOrderBookBySlug(
  slug: string | null | undefined,
  options?: {
    rank?: number | null;
    subtype?: string | null;
    priority?: "interactive" | "background";
  },
): Promise<ItemOrderBookResult> {
  const normalizedSlug = normalizeWfmSlug(slug);
  bumpCounter("requests");
  if (!normalizedSlug) {
    bumpCounter("resultError");
    return { status: "error", slug: "" };
  }

  const normalizedRank = normalizeRank(options?.rank ?? null);
  const normalizedSubtype = normalizeSubtype(options?.subtype);
  const key = subtypedCacheKey(normalizedSlug, normalizedRank, normalizedSubtype);

  const cached = cacheBySlug.get(key);
  if (cached && isFresh(cached)) {
    if (cached.status === "ok") {
      bumpCounter("cacheHitOk");
      return { status: "ok", data: cached.data };
    }
    bumpCounter("cacheHitNoData");
    return { status: "not_found", slug: normalizedSlug };
  }

  const inFlight = inFlightBySlug.get(key);
  const priority = options?.priority ?? "interactive";
  if (inFlight) {
    orderBookQueue.promote(inFlight.owner, priority);
    return inFlight.promise;
  }

  const requestClearGeneration = clearGeneration;
  const requestKeyGeneration = generationBySlug.get(key) ?? 0;
  const isCurrentRequest = (): boolean =>
    requestClearGeneration === clearGeneration &&
    requestKeyGeneration === (generationBySlug.get(key) ?? 0);

  const requestOwner = Symbol(key);
  const request = orderBookQueue
    .enqueue(
      async (): Promise<ItemOrderBookResult> => {
        // Cache invalidation must also retire work that has not reached the network.
        if (!isCurrentRequest()) return { status: "error", slug: normalizedSlug };
        const result = await fetchDirectOrderBook(
          normalizedSlug,
          normalizedRank,
          normalizedSubtype,
          priority === "background",
        );
        if (result.status === "ok") {
          const data: ItemOrderBook = result.data;
          if (isCurrentRequest()) {
            cacheBySlug.set(key, { status: "ok", data, cachedAt: Date.now() });
          }
          return { status: "ok", data };
        }

        if (result.status === "not_found") {
          if (isCurrentRequest()) {
            cacheBySlug.set(key, { status: "not_found", cachedAt: Date.now() });
          }
          return { status: "not_found", slug: normalizedSlug };
        }

        return { status: "error", slug: normalizedSlug };
      },
      priority,
      requestOwner,
    )
    .finally(() => {
      if (inFlightBySlug.get(key)?.owner === requestOwner) inFlightBySlug.delete(key);
    });

  inFlightBySlug.set(key, { owner: requestOwner, promise: request });
  return request;
}
