import { describe, expect, it } from "vitest";

import {
  bountyStageLabel,
  cyclePlaceLabel,
  rewardItemLabel,
  worldLabel,
} from "../../../../src/lib/world/worldLabels";

describe("worldLabel", () => {
  it("swaps in the label and falls back to the English text", () => {
    expect(worldLabel({ Lith: "리스" }, "Lith")).toBe("리스");
    expect(worldLabel({ Lith: "리스" }, "Meso")).toBe("Meso");
    expect(worldLabel(undefined, "Meso")).toBe("Meso");
    expect(worldLabel({}, null)).toBe("");
  });

  it("looks a job up by its path, showing the English title without one", () => {
    const labels = { "/Jobs/Capture": "생포하라" };
    expect(worldLabel(labels, "Capture Bounty", "/Jobs/Capture")).toBe("생포하라");
    expect(worldLabel(labels, "Capture Bounty", "/Jobs/Other")).toBe("Capture Bounty");
  });
});

describe("cyclePlaceLabel", () => {
  it("names a cycle row by the place the game shows", () => {
    expect(cyclePlaceLabel({ "Orb Vallis": "오브 협곡" }, "vallis")).toBe("오브 협곡");
    expect(cyclePlaceLabel({}, "vallis")).toBeNull();
  });
});

describe("bountyStageLabel", () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    key === "world.bountyStage" ? `${String(params?.n)}단계` : "의뢰";

  it("translates the reward table's stage names", () => {
    expect(bountyStageLabel("Stage 2", t as never)).toBe("2단계");
    expect(bountyStageLabel("Bounty", t as never)).toBe("의뢰");
    expect(bountyStageLabel("Other", t as never)).toBe("Other");
  });
});

describe("rewardItemLabel", () => {
  it("keeps the count in front of the game-language name", () => {
    const forma = { name: "Forma Blueprint", displayName: "포르마 설계도" };
    expect(rewardItemLabel("2X Forma Blueprint", forma)).toBe("2X 포르마 설계도");
    expect(rewardItemLabel("Forma Blueprint", forma)).toBe("포르마 설계도");
    expect(rewardItemLabel("Forma Blueprint", { name: "Forma Blueprint" })).toBe("Forma Blueprint");
    expect(rewardItemLabel("Endo", null)).toBe("Endo");
  });
});
