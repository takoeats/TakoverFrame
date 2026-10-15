import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/logger", () => ({
  withScope: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../../services/wfmSession", () => ({ getToken: vi.fn(() => "jwt") }));
vi.mock("../../../services/wfmOrders", () => ({ getMyOrders: vi.fn(), closeOrder: vi.fn() }));
vi.mock("../../../services/wfmCatalog", () => ({
  lookupByName: vi.fn(() => null),
  lookupItemDetails: vi.fn(async () => null),
  resolveSetMembership: vi.fn(async () => ({ kind: "not-set" })),
}));
vi.mock("../../../services/wfmContracts", () => ({
  getMyContracts: vi.fn(),
  closeContract: vi.fn(),
}));

import { closeMatchedOrder, matchTradeToOrders } from "../../../services/tradeWfmMatcher";
import * as wfmOrders from "../../../services/wfmOrders";

const SALE = {
  partner: "Buyer",
  platChange: 8,
  type: "sale" as const,
  items: [{ displayName: "Pistol Elementalist", count: 1, direction: "given" as const }],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T00:24:27Z"));
  vi.mocked(wfmOrders.closeOrder).mockResolvedValue({
    closed: false,
    id: "o1",
    remainingQuantity: 1,
  });
  vi.mocked(wfmOrders.getMyOrders).mockResolvedValue({
    sell: [
      {
        id: "o1",
        orderType: "sell",
        platinum: 8,
        quantity: 2,
        visible: true,
        modRank: null,
        subtype: null,
        itemId: null,
        itemName: "Pistol Elementalist",
        itemUrlName: "pistol_elementalist",
        itemThumb: null,
      },
    ],
    buy: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// 2026-10-07: two sales from one listing 28s apart; the second found no listing.
describe("a second sale from the same listing", () => {
  it("matches the listing again 28s later", async () => {
    const [first] = await matchTradeToOrders(SALE);
    expect(await closeMatchedOrder(first)).toBe(true);

    vi.advanceTimersByTime(28_000);
    expect((await matchTradeToOrders(SALE)).map((match) => match.orderId)).toEqual(["o1"]);
  });

  it("still skips it for a duplicate delivery of the same trade", async () => {
    const [first] = await matchTradeToOrders(SALE);
    await closeMatchedOrder(first);

    vi.advanceTimersByTime(1_000);
    expect(await matchTradeToOrders(SALE)).toEqual([]);
  });
});
