import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_GAME_LOCALE, setGameLocale } from "../../services/gameLocale";
import * as itemDb from "../../services/itemDatabase";
import { cleanStatLabel, getRivenStatNames, getRivenWeaponLabels } from "../../services/rivenNames";

beforeAll(() => {
  itemDb.buildDatabase();
});

afterEach(() => {
  setGameLocale(DEFAULT_GAME_LOCALE);
});

describe("riven stat names", () => {
  it("drops the value wherever the language puts it, unit included", () => {
    expect(cleanStatLabel("|val|% Critical Chance")).toBe("Critical Chance");
    expect(cleanStatLabel("|val|% 연사력 (활 계열 무기에 2배)")).toBe("연사력");
    expect(cleanStatLabel("연속기 지속 시간 |val|초")).toBe("연속기 지속 시간");
    expect(cleanStatLabel("|val|% <DT_FIRE_COLOR>화염")).toBe("화염");
  });

  it("adds nothing under English", () => {
    expect(getRivenStatNames()).toEqual({});
  });

  it("keys every English label the app shows", () => {
    setGameLocale("ko");
    const names = getRivenStatNames();

    expect(names["critical chance"]).toBe("치명타 확률");
    expect(names["fire rate"]).toBe("연사력");
    expect(names["attack speed"]).toBe("공격 속도");
    expect(names["combo duration"]).toBe("연속기 지속 시간");
    expect(names["damage to grineer"]).toBe("그리니어에 대한 피해");
    expect(names["fire rate / attack speed"]).toBe("연사력 / 공격 속도");
  });
});

describe("riven weapon labels", () => {
  it("adds nothing under English", () => {
    expect(getRivenWeaponLabels()).toEqual({});
  });

  it("names riven weapons in the game language by their English name", () => {
    setGameLocale("ko");
    const labels = getRivenWeaponLabels();

    expect(labels["soma"]).toBe("소마");
    expect(labels["kuva bramma"]).toBe("쿠바 브람마");
  });
});
