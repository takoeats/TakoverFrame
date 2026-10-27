import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/logger", () => ({
  withScope: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  auctionSearchBudgetForTest,
  isAuctionSearchPath,
  waitForAuctionSearchSlot,
} from "../../services/wfmAuctionSearchBudget";

describe("auction search budget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    auctionSearchBudgetForTest.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("only covers auction search", () => {
    expect(isAuctionSearchPath("/auctions/search?type=riven&weapon_url_name=kuva_bramma")).toBe(
      true,
    );
    expect(isAuctionSearchPath("/auctions/create")).toBe(false);
    expect(isAuctionSearchPath("/items/x/statistics")).toBe(false);
  });

  it("holds background searches past ten a minute until the window frees", async () => {
    for (let i = 0; i < 10; i++) await waitForAuctionSearchSlot("background");
    let eleventh = false;
    const pending = waitForAuctionSearchSlot("background").then(() => {
      eleventh = true;
    });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(eleventh).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    await pending;
    expect(eleventh).toBe(true);
  });

  it("fails an interactive search fast rather than holding it for the window", async () => {
    for (let i = 0; i < 10; i++) await waitForAuctionSearchSlot("background");
    await expect(waitForAuctionSearchSlot("interactive")).rejects.toMatchObject({
      code: "WFM_RATE_LIMITED",
    });
    // A refused search books nothing, so the next background one is not pushed back.
    let next = false;
    const pending = waitForAuctionSearchSlot("background").then(() => {
      next = true;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await pending;
    expect(next).toBe(true);
  });
});
