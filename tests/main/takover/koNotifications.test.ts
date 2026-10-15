import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { setOverlayLocale } from "../../../ipc/overlayI18n";
import { setGameLocale } from "../../../services/gameLocale";
import * as itemDb from "../../../services/itemDatabase";
import {
  localizedTradeMatch,
  tradeNotificationText,
  whisperNotificationText,
} from "../../../services/takover/koNotifications";
import type { TradeMatchPayload } from "../../../config/shared/tradeMatch";

const SALE: TradeMatchPayload = {
  kind: "order",
  orderId: "o1",
  itemName: "Titania Prime Blueprint",
  itemUrlName: "titania_prime_blueprint",
  itemThumb: null,
  quantity: 1,
  platinum: 10,
  type: "sale",
  partner: "Buyer",
};

beforeAll(() => {
  itemDb.buildDatabase();
  setGameLocale("ko");
});

afterAll(() => {
  setGameLocale("en");
});

afterEach(() => {
  setOverlayLocale("en");
});

describe("Korean notification text", () => {
  it("keeps upstream's English text for the English UI", () => {
    expect(tradeNotificationText("closed", SALE)).toEqual({
      title: "Listing Closed",
      body: "Titania Prime Blueprint 10p with Buyer",
    });
    expect(whisperNotificationText("Buyer")).toEqual({
      title: "New in-game conversation",
      body: "from Buyer",
    });
  });

  it("writes trade and whisper notifications in Korean for the Korean UI", () => {
    setOverlayLocale("ko");
    expect(tradeNotificationText("closed", SALE)).toEqual({
      title: "등록 마감됨",
      body: "티타니아 프라임 설계도 10p · Buyer",
    });
    expect(tradeNotificationText("detected", { ...SALE, quantity: 3 }).title).toBe("거래 완료");
    expect(whisperNotificationText("Buyer")).toEqual({
      title: "새 귓속말",
      body: "보낸 사람: Buyer",
    });
  });

  it("names the toast's item in the game language", () => {
    expect(localizedTradeMatch(SALE).itemName).toBe("티타니아 프라임 설계도");
    const unknown = { ...SALE, itemName: "Not An Item" };
    expect(localizedTradeMatch(unknown)).toBe(unknown);
  });
});
