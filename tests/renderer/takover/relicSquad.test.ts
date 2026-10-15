import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/ipc.js", () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));

describe("relic squad size", () => {
  const pushRelicFilters = vi.fn();
  let mem: Map<string, string>;

  beforeEach(() => {
    mem = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    });
    vi.stubGlobal("window", { api: { pushRelicFilters } });
    pushRelicFilters.mockReset();
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("pushes nothing and keeps the solo planner until a size is picked", async () => {
    const { pushStoredRelicSquadSize } = await import("../../../src/lib/takover/relicSquad.js");
    const { relicViewState } = await import("../../../src/stores/relics.js");
    pushStoredRelicSquadSize();
    expect(pushRelicFilters).not.toHaveBeenCalled();
    expect(get(relicViewState).squadSize).toBe(1);
  });

  it("sends a picked size alone and restores it on the next launch", async () => {
    const { setRelicFilter } = await import("../../../src/stores/relics.js");
    setRelicFilter({ squadSize: 3 });
    expect(pushRelicFilters).toHaveBeenLastCalledWith({ squadSize: 3 });

    vi.resetModules();
    pushRelicFilters.mockReset();
    const { pushStoredRelicSquadSize } = await import("../../../src/lib/takover/relicSquad.js");
    const { relicViewState } = await import("../../../src/stores/relics.js");
    expect(get(relicViewState).squadSize).toBe(3);
    pushStoredRelicSquadSize();
    expect(pushRelicFilters).toHaveBeenCalledWith({ squadSize: 3 });
  });
});
