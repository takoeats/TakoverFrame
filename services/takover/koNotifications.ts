// Text for the desktop notifications main writes itself (trade, whisper): Korean
// with the Korean UI, item names in the game language like the rest of the app.

import { mainMessage, overlayMessages } from "../../ipc/overlayI18n";
import { tradeNotificationBody, tradeNotificationTitle } from "../../config/shared/notifications";
import type { TradeMatchPayload, TradeNotificationStatus } from "../../config/shared/tradeMatch";
import { localizedTradeItemName } from "./koTrade";

const STATUS_KEYS = {
  closed: "overlay.trade.listingClosed",
  "no-match": "overlay.trade.noListingMatched",
  "match-failed": "overlay.trade.noListingMatched",
  "close-failed": "overlay.trade.closingFailed",
  detected: "overlay.trade.tradeFinished",
  "price-low": "overlay.trade.priceLow",
} as const satisfies Record<TradeNotificationStatus, string>;

function isKoreanUi(): boolean {
  return overlayMessages().locale === "ko";
}

export function localizedTradeMatch<T extends TradeMatchPayload>(match: T): T {
  const itemName = localizedTradeItemName(match.itemName);
  return itemName === match.itemName ? match : { ...match, itemName };
}

export function tradeNotificationText(
  status: TradeNotificationStatus,
  match: TradeMatchPayload,
): { title: string; body: string } {
  const title = tradeNotificationTitle(status);
  const listed = match.listedPlatinum;
  if (!isKoreanUi()) {
    const body = tradeNotificationBody(match);
    return { title, body: listed ? `${body} (listed ${listed}p)` : body };
  }

  const quantity = match.quantity > 1 ? `${match.quantity}× ` : "";
  const priced = (match.type === "sale" || match.type === "purchase") && match.platinum > 0;
  const platinum = priced ? ` ${match.platinum}p` : "";
  const partner = match.partner ? ` · ${match.partner}` : "";
  return {
    title: mainMessage(STATUS_KEYS[status] ?? STATUS_KEYS.detected, title).replace(
      "{listed}",
      String(listed ?? ""),
    ),
    body: `${quantity}${localizedTradeItemName(match.itemName)}${platinum}${partner}`,
  };
}

export function whisperNotificationText(playerName: string): { title: string; body: string } {
  if (!isKoreanUi()) return { title: "New in-game conversation", body: `from ${playerName}` };
  return { title: "새 귓속말", body: `보낸 사람: ${playerName}` };
}
