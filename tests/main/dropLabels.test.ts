import os from "node:os";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { DropRow } from "../../config/shared/dropTypes";
import { searchDrops, setRowsForTest } from "../../services/dropData";
import { labelDropRows } from "../../services/dropLabels";
import { DEFAULT_GAME_LOCALE, setGameLocale } from "../../services/gameLocale";
import * as itemDb from "../../services/itemDatabase";

vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() } }));

beforeAll(() => {
  itemDb.buildDatabase();
});

afterEach(() => {
  setGameLocale(DEFAULT_GAME_LOCALE);
});

function row(item: string, place: string, kind: DropRow["kind"] = "mission"): DropRow {
  return { item, place, rarity: "Common", chance: 10, kind };
}

function labels(item: string, place: string, kind?: DropRow["kind"]) {
  const [labeled] = labelDropRows([row(item, place, kind)]);
  return { item: labeled.itemLabel ?? labeled.item, place: labeled.placeLabel ?? labeled.place };
}

describe("drop labels", () => {
  it("leaves rows untouched under English", () => {
    const rows = [row("Forma Blueprint", "Mantle (Earth), Rotation A")];
    expect(labelDropRows(rows)[0]).toBe(rows[0]);
  });

  it("names items in the game language, count kept", () => {
    setGameLocale("ko");
    expect(labels("Forma Blueprint", "Sortie").item).toBe("포르마 설계도");
    expect(labels("2X Forma Blueprint", "Sortie").item).toBe("2X 포르마 설계도");
    expect(labels("100 Endo", "Sortie").item).toBe("100 엔도");
    expect(labels("Rhino Chassis Blueprint", "Sortie").item).toBe("라이노 섀시 설계도");
    expect(labels("Lith A1 Relic", "Sortie").item).toBe("리스 A1 성유물");
  });

  it("puts composed places back together", () => {
    setGameLocale("ko");
    expect(labels("Forma Blueprint", "Mantle (Earth), Rotation A").place).toBe(
      "Mantle (지구), 로테이션 A",
    );
    expect(labels("Forma Blueprint", "Terminus (Caches) (Mercury)").place).toBe(
      "Terminus (저장고) (수성)",
    );
    expect(labels("Forma Blueprint", "Axi A1 Relic", "relic").place).toBe("액시 A1 성유물");
    expect(
      labels("Forma Blueprint", "Level 5 - 15 Cetus Bounty, Rotation A (Stage 1)", "bounty").place,
    ).toBe("레벨 5 - 15 시터스 의뢰, 로테이션 A (1단계)");
  });

  it("names enemies", () => {
    setGameLocale("ko");
    expect(labels("Vitality", "Elite Lancer", "enemy").place).toBe("엘리트 랜서");
    expect(labels("Vitality", "Corrupted Heavy Gunner", "enemy").place).toBe("커럽티드 헤비 거너");
  });

  it("keeps English where no name is known", () => {
    setGameLocale("ko");
    expect(labels("No Such Thing", "Nowhere At All")).toEqual({
      item: "No Such Thing",
      place: "Nowhere At All",
    });
  });
});

describe("drop search in the game language", () => {
  const rows = [
    row("Forma Blueprint", "Mantle (Earth), Rotation A"),
    row("Vitality", "Elite Lancer", "enemy"),
    row("Vitality", "Lancer", "enemy"),
  ];

  it("finds items, places and enemies by the name shown, spacing aside", () => {
    setRowsForTest(rows);
    setGameLocale("ko");

    expect(searchDrops("포르마설계도", "item").rows.map((r) => r.itemLabel)).toEqual([
      "포르마 설계도",
    ]);
    expect(searchDrops("지구", "place").rows.map((r) => r.place)).toEqual([
      "Mantle (Earth), Rotation A",
    ]);
    expect(searchDrops("엘리트 랜서", "enemy").rows.map((r) => r.placeLabel)).toEqual([
      "엘리트 랜서",
    ]);
    expect(searchDrops("랜서", "enemy").total).toBe(2);
  });

  it("still finds English names, and adds no labels under English", () => {
    setRowsForTest(rows);
    setGameLocale("ko");
    expect(searchDrops("forma", "item").rows[0].itemLabel).toBe("포르마 설계도");

    setGameLocale(DEFAULT_GAME_LOCALE);
    expect(searchDrops("포르마", "item").total).toBe(0);
    expect(searchDrops("forma", "item").rows[0]).toEqual(rows[0]);
  });
});
