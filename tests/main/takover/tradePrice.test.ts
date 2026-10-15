import { describe, expect, it } from "vitest";

import { priceShortfall } from "../../../config/shared/takover/tradePrice";
import type { TradeMatchPayload } from "../../../config/shared/tradeMatch";

function listing(itemName: string, platinum: number, quantity = 1): TradeMatchPayload {
  return {
    kind: "order",
    orderId: itemName,
    itemName,
    itemUrlName: null,
    itemThumb: null,
    quantity,
    platinum,
    partner: "Buyer",
    type: "sale",
  };
}

const sale = (platChange: number) => ({ type: "sale" as const, platChange });

describe("priceShortfall", () => {
  it("flags an offer below the listing", () => {
    expect(priceShortfall(sale(5), [listing("Vital Sense", 8)], true)).toMatchObject({
      itemName: "Vital Sense",
      platinum: 5,
      listedPlatinum: 8,
    });
  });

  it("adds up sets, extra parts and quantities", () => {
    const matches = [listing("Acceltra Prime Set", 35, 2), listing("Acceltra Prime Barrel", 6)];
    expect(priceShortfall(sale(76), matches, true)).toBeNull();
    expect(priceShortfall(sale(70), matches, true)).toMatchObject({
      itemName: "Acceltra Prime Set +1",
      listedPlatinum: 76,
    });
  });

  it("stays quiet at or above the listing", () => {
    expect(priceShortfall(sale(8), [listing("Vital Sense", 8)], true)).toBeNull();
    expect(priceShortfall(sale(10), [listing("Vital Sense", 8)], true)).toBeNull();
  });

  it("cannot judge a trade with an unlisted item, or a purchase", () => {
    expect(priceShortfall(sale(1), [listing("Vital Sense", 8)], false)).toBeNull();
    expect(priceShortfall(sale(1), [], true)).toBeNull();
    expect(
      priceShortfall({ type: "purchase", platChange: 1 }, [listing("Vital Sense", 8)], true),
    ).toBeNull();
  });
});
