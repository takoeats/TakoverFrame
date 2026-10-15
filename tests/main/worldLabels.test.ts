import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_GAME_LOCALE, setGameLocale } from "../../services/gameLocale";
import * as itemDb from "../../services/itemDatabase";
import { buildArbiLabels, buildWorldLabels, withWorldLabels } from "../../services/worldLabels";

beforeAll(() => {
  itemDb.buildDatabase();
});

afterEach(() => {
  setGameLocale(DEFAULT_GAME_LOCALE);
});

const STATE = {
  fissures: [{ tier: "Lith", missionType: "Spy", node: "Unda, Venus" }],
  invasions: [
    {
      node: "Yuvarium, Lua",
      attacker: { faction: "Grineer", reward: { countedItems: [{ count: 3, type: "Fieldron" }] } },
      defender: { faction: "Infested", reward: { countedItems: [] } },
    },
  ],
  bounties: [
    {
      syndicate: "Ostrons",
      syndicateKey: "CetusSyndicate",
      jobs: [
        {
          type: "Capture Bounty",
          jobType: "/Lotus/Types/Gameplay/Eidolon/Jobs/CaptureBountyCapOne",
        },
      ],
    },
  ],
  sortie: { boss: "Hek", missions: [{ node: "War (Mars)", mission: "교란" }] },
  archonHunt: { boss: "Nira", missions: [] },
  voidTrader: { location: "Orcus Relay (Pluto)", inventory: [] },
  steelPath: { currentReward: { name: "3x Forma" } },
  duviriCycle: { state: "Sorrow", choices: [{ category: "normal", choices: ["Saryn"] }] },
};

describe("world labels", () => {
  it("adds nothing under English", () => {
    expect(buildWorldLabels(STATE)).toBeNull();
    expect(withWorldLabels(STATE)).toBe(STATE);
  });

  it("labels what the world tab shows in the game language", () => {
    setGameLocale("ko");
    const labels = buildWorldLabels(STATE) ?? {};

    expect(labels["Lith"]).toBe("리스");
    // The same word as the sortie row, which reads DE's MT_ table.
    expect(labels["Spy"]).toBe("첩보활동");
    expect(labels["Unda, Venus"]).toBe("Unda, 금성");
    expect(labels["Yuvarium, Lua"]).toBe("유바리움, 루아");
    expect(labels["Grineer"]).toBe("그리니어");
    expect(labels["Infested"]).toBe("인페스티드");
    expect(labels["Fieldron"]).toBe("필드론");
    expect(labels["Ostrons"]).toBe("오스트론");
    expect(labels["/Lotus/Types/Gameplay/Eidolon/Jobs/CaptureBountyCapOne"]).toBe(
      "그리니어 사령관을 생포하라",
    );
    expect(labels["Hek"]).toBe("헥");
    expect(labels["Nira"]).toBe("집정관 나이라");
    expect(labels["War (Mars)"]).toBe("워 (화성)");
    expect(labels["Orcus Relay (Pluto)"]).toBe("오르커스 릴레이 (명왕성)");
    expect(labels["3x Forma"]).toBe("3x 포르마");
    expect(labels["Sorrow"]).toBe("슬픔");
    expect(labels["Saryn"]).toBe("새린");
    // The fissure-alert pickers and cycle rows read these without world data.
    expect(labels["Orb Vallis"]).toBe("오브 협곡");
    expect(labels["Void Flood"]).toBe("보이드 홍수");
  });

  it("leaves the cached English state untouched", () => {
    setGameLocale("ko");
    const labeled = withWorldLabels(STATE);

    expect(labeled).not.toBe(STATE);
    expect(labeled.fissures[0].missionType).toBe("Spy");
    expect("labels" in STATE).toBe(false);
  });

  it("labels arbitration rows", () => {
    setGameLocale("ko");
    expect(
      buildArbiLabels([{ node: "Casta (Ceres)", mission: "Defense", faction: "Corrupted" }]),
    ).toMatchObject({ "Casta (Ceres)": "Casta (세레스)", Defense: "방어", Corrupted: "커럽티드" });
  });
});
