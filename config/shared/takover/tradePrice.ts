// Is the offer in a trade confirmation below what the matched listings ask?
// Pure, so main's price check and its tests share it.

import { summarizeMatches, type TradeMatchPayload } from "../tradeMatch";
import type { TradeType } from "../statsTypes";

/** Listing prices are per unit (per set for a set listing). */
function listedTotal(matches: readonly TradeMatchPayload[]): number {
  return matches.reduce((sum, match) => sum + match.platinum * match.quantity, 0);
}

/** The toast payload when the offer falls short, else null. Only a sale whose
 *  every item matched a listing can be judged: an unlisted item has no price. */
export function priceShortfall(
  trade: { type: TradeType; platChange: number },
  matches: TradeMatchPayload[],
  complete: boolean,
): TradeMatchPayload | null {
  if (trade.type !== "sale" || !complete || matches.length === 0) return null;
  const listed = listedTotal(matches);
  if (trade.platChange >= listed) return null;
  const summary = summarizeMatches(matches, trade.platChange);
  return summary && { ...summary, listedPlatinum: listed };
}
