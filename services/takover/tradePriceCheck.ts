// Warns while the trade confirmation is still open when the buyer's platinum is
// below what the matched warframe.market listings ask. Uses the same matching
// that later closes the listings, sets included; read-only, closes nothing.

import ctx from "../../ipc/context";
import * as tradeNotificationIpc from "../../ipc/tradeNotificationIpc";
import { sendDesktopNotificationRaw } from "../../ipc/worldStateIpc";
import { isTradeNotificationOverlayEnabled } from "../../config/runtime/overlaySettings";
import { priceShortfall } from "../../config/shared/takover/tradePrice";
import type { ParsedLogTrade } from "../eeLogMonitor";
import { withScope } from "../logger";
import { matchTradeToOrdersWithCoverage } from "../tradeWfmMatcher";
import * as wfmSession from "../wfmSession";
import { isTradeDialogPending, onTradeDialogOpen } from "./koTrade";
import { tradeNotificationText } from "./koNotifications";

const log = withScope("tradePriceCheck");

async function checkTradePrice(trade: ParsedLogTrade, dialog: number): Promise<void> {
  if (trade.type !== "sale" || !wfmSession.getToken()) return;
  const { matches, complete } = await matchTradeToOrdersWithCoverage(trade);
  const shortfall = priceShortfall(trade, matches, complete);
  if (!shortfall) return;
  if (!isTradeDialogPending(dialog)) {
    log.info("[PriceCheck] Offer below listing, but the dialog already closed");
    return;
  }

  log.info(
    `[PriceCheck] Offer ${trade.platChange}p below listing ${shortfall.listedPlatinum}p ` +
      `from ${trade.partner}`,
  );
  if (isTradeNotificationOverlayEnabled(ctx.overlaySettings)) {
    tradeNotificationIpc.showTradeNotification(shortfall, "price-low");
  } else if (ctx.overlaySettings.tradeDesktopNotificationsEnabled) {
    const { title, body } = tradeNotificationText("price-low", shortfall);
    sendDesktopNotificationRaw(title, body, "trade");
  }
}

export function registerTradePriceCheck(): void {
  onTradeDialogOpen((trade, dialog) => {
    checkTradePrice(trade, dialog).catch((err) => log.warn("[PriceCheck] failed:", String(err)));
  });
}
