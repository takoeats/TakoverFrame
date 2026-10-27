import { rateLimitError, type WfmRequestPriority } from "./wfmScheduler";
import { sleep } from "./sleep";

/** WFM limits contract search to roughly 10-20 requests per minute on top of
 *  the general 3/s, so auction searches get their own sliding window. */
const WFM_AUCTION_SEARCH_DEFAULTS = {
  WINDOW_MS: 60_000,
  MAX_PER_WINDOW: 10,
  /** Same bound as the scheduler: an interactive search that would sit longer
   *  fails now with the rate-limit error instead. */
  MAX_INTERACTIVE_WAIT_MS: 10_000,
} as const;

const TUNING = { ...WFM_AUCTION_SEARCH_DEFAULTS };

/** Start times, booked in order, so the array stays sorted even with slots
 *  that lie in the future. */
let _slots: number[] = [];

export function isAuctionSearchPath(path: string): boolean {
  return path.startsWith("/auctions/search");
}

export async function waitForAuctionSearchSlot(
  priority: WfmRequestPriority = "interactive",
): Promise<void> {
  const now = Date.now();
  while (_slots.length > 0 && _slots[0] <= now - TUNING.WINDOW_MS) _slots.shift();
  const slot =
    _slots.length < TUNING.MAX_PER_WINDOW
      ? Math.max(now, _slots[_slots.length - 1] ?? now)
      : _slots[_slots.length - TUNING.MAX_PER_WINDOW] + TUNING.WINDOW_MS;
  const waitMs = slot - now;
  if (priority === "interactive" && waitMs > TUNING.MAX_INTERACTIVE_WAIT_MS) {
    throw rateLimitError(waitMs);
  }
  _slots.push(slot);
  if (waitMs > 0) await sleep(waitMs);
}

export const auctionSearchBudgetForTest = {
  reset(): void {
    _slots = [];
    Object.assign(TUNING, WFM_AUCTION_SEARCH_DEFAULTS);
  },
};
