import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _parseTradeDialog,
  forceEeLogPoll,
  startWatching,
  stopWatching,
  type ParsedLogTrade,
} from "../../../services/eeLogMonitor";
import { setGameLocale } from "../../../services/gameLocale";
import * as itemDb from "../../../services/itemDatabase";
import {
  announceTradeDialog,
  englishTradeItemLine,
  isTradeDialogPending,
  localizedTradeItemName,
  onTradeDialogOpen,
  settleTradeDialog,
} from "../../../services/takover/koTrade";

const hoisted = vi.hoisted(() => ({ logPath: "" }));

vi.mock("chokidar", () => ({
  default: { watch: () => ({ on: () => undefined, close: () => undefined }) },
}));

vi.mock("../../../services/eeLogPath", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../services/eeLogPath")>()),
  resolveEeLogPath: () => hoisted.logPath,
}));

vi.mock("../../../services/dbwinMonitor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../services/dbwinMonitor")>()),
  isDbwinActive: () => false,
  startDbwinWorker: () => undefined,
  stopDbwinWorker: () => undefined,
}));

const GLYPH = String.fromCharCode(0xe000);
const TAIL = ", title= leftItem=/Menu/Confirm_Item_Ok, rightItem=/Menu/Confirm_Item_Cancel)";

// Two sales from a Korean client's EE.log (2026-10-06), byte for byte apart from
// the partner names: CRLF lines, bare-CR item lines, a glyph after the partner.
const KO_SALES =
  "785.651 Script [Info]: Dialog.lua: Dialog::CreateOkCancel(description=이 거래를 수락하시겠습니까? 현재 제시중인 아이템:\r\n" +
  "\r바이탈 센스 (레어 0 랭크)\r\r\n\r\r\n" +
  "BuyerOne 플레이어에게 다음 거래 아이템을 받습니다:\r\n" +
  "\r플래티넘 x 5" +
  TAIL +
  "\r\n" +
  "789.030 Script [Info]: Dialog.lua: SendResult_MENU_SELECT()\r\n" +
  "789.989 Script [Info]: Dialog.lua: Dialog::CreateOk(description=거래가 성사되었습니다!, title= leftItem=/Menu/Confirm_Item_Ok)\r\n" +
  "983.281 Script [Info]: Dialog.lua: Dialog::CreateOkCancel(description=이 거래를 수락하시겠습니까? 현재 제시중인 아이템:\r\n" +
  "\r프로티아 프라임 설계도\r\n\r프로티아 프라임 시스템 설계도\r\r\n\r\r\n" +
  "BuyerTwo" +
  GLYPH +
  " 플레이어에게 다음 거래 아이템을 받습니다:\r\n" +
  "\r플래티넘 x 10" +
  TAIL +
  "\r\n" +
  "986.337 Script [Info]: Dialog.lua: SendResult_MENU_SELECT()\r\n" +
  "989.002 Script [Info]: Dialog.lua: Dialog::CreateOk(description=거래가 성사되었습니다!, title= leftItem=/Menu/Confirm_Item_Ok)\r\n";

// Runs against the real bundled name dictionary.
beforeAll(() => {
  itemDb.buildDatabase();
  setGameLocale("ko");
});

afterAll(() => {
  setGameLocale("en");
});

describe("Korean trade dialog through the log reader", () => {
  let tmpDir = "";
  let trades: ParsedLogTrade[] = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "takover-ko-trade-"));
    hoisted.logPath = path.join(tmpDir, "EE.log");
    fs.writeFileSync(hoisted.logPath, "");
    trades = [];
    vi.useFakeTimers();
    startWatching({ onTradeConfirmed: (trade) => void trades.push(trade) });
  });

  afterEach(() => {
    stopWatching();
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records each sale with English item names", () => {
    fs.appendFileSync(hoisted.logPath, KO_SALES);
    forceEeLogPoll();

    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      type: "sale",
      platChange: 5,
      partner: "BuyerOne",
      items: [{ displayName: "Vital Sense (Rank 0)", count: 1, direction: "given" }],
      logStamp: "785.651",
    });
    expect(trades[1]).toMatchObject({
      type: "sale",
      platChange: 10,
      partner: "BuyerTwo",
      items: [
        { displayName: "Protea Prime Blueprint", count: 1, direction: "given" },
        { displayName: "Protea Prime Systems Blueprint", count: 1, direction: "given" },
      ],
    });
  });
});

describe("trade dialog announcement", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "takover-ko-dialog-"));
    hoisted.logPath = path.join(tmpDir, "EE.log");
    fs.writeFileSync(hoisted.logPath, "");
    vi.useFakeTimers();
    startWatching({});
  });

  afterEach(() => {
    onTradeDialogOpen(null);
    stopWatching();
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("announces the dialog once before the trade goes through", () => {
    const seen: Array<{ plat: number; dialog: number }> = [];
    onTradeDialogOpen((trade, dialog) => seen.push({ plat: trade.platChange, dialog }));
    const firstSale = KO_SALES.slice(0, KO_SALES.indexOf("789.030"));

    fs.appendFileSync(hoisted.logPath, firstSale);
    forceEeLogPoll();
    expect(seen.map((entry) => entry.plat)).toEqual([5]);
    expect(isTradeDialogPending(seen[0].dialog)).toBe(true);

    fs.appendFileSync(hoisted.logPath, KO_SALES.slice(firstSale.length));
    forceEeLogPoll();
    expect(seen.map((entry) => entry.plat)).toEqual([5, 10]);
    // Both went through, so neither warning would still be in time.
    expect(isTradeDialogPending(seen[0].dialog)).toBe(false);
    expect(isTradeDialogPending(seen[1].dialog)).toBe(false);
  });
});

describe("trade dialog echoes", () => {
  afterEach(() => onTradeDialogOpen(null));

  const firstDialog = KO_SALES.slice(0, KO_SALES.indexOf("789.030")).split("\r\n");
  // Each test opens its own dialog: the echo memory is module state.
  const dialogAt = (stamp: string) => [
    firstDialog[0].replace("785.651", stamp),
    ...firstDialog.slice(1),
  ];
  const announce = (buffer: string[]) =>
    announceTradeDialog(buffer, () => _parseTradeDialog(buffer));

  // DBWIN delivers the dialog live; the file poll re-delivers it seconds later.
  it("does not warn twice for one dialog read from both sources", () => {
    const seen: number[] = [];
    onTradeDialogOpen((_trade, dialog) => seen.push(dialog));

    announce(dialogAt("2001.000"));
    announce(dialogAt("2001.000"));

    expect(seen).toHaveLength(1);
    expect(isTradeDialogPending(seen[0])).toBe(true);
  });

  it("keeps a settled trade settled when its file echo arrives", () => {
    const seen: number[] = [];
    onTradeDialogOpen((_trade, dialog) => seen.push(dialog));

    announce(dialogAt("2002.000"));
    settleTradeDialog();
    announce(dialogAt("2002.000"));

    expect(seen).toHaveLength(1);
    expect(isTradeDialogPending(seen[0])).toBe(false);
  });

  it("warns again when the same offer is made in a new dialog", () => {
    const seen: number[] = [];
    onTradeDialogOpen((_trade, dialog) => seen.push(dialog));

    announce(dialogAt("2003.000"));
    announce(dialogAt("2190.000"));

    expect(seen).toHaveLength(2);
  });
});

describe("Korean trade dialog parsing", () => {
  it("reads a purchase, where the platinum is offered", () => {
    const parsed = _parseTradeDialog([
      "1.000 Script [Info]: Dialog.lua: Dialog::CreateOkCancel(description=이 거래를 수락하시겠습니까? 현재 제시중인 아이템:",
      "플래티넘 x 15",
      "Seller 플레이어에게 다음 거래 아이템을 받습니다:",
      "타게팅 서브시스템 (언커먼 0 랭크)" + TAIL,
    ]);
    expect(parsed).toMatchObject({
      type: "purchase",
      platChange: 15,
      partner: "Seller",
      items: [{ displayName: "Targeting Subsystem (Rank 0)", direction: "received" }],
    });
  });

  it("keeps a name the dictionary cannot place, whole", () => {
    expect(englishTradeItemLine("없는 아이템 이름")).toBe("없는 아이템 이름");
    const parsed = _parseTradeDialog([
      "이 거래를 수락하시겠습니까? 현재 제시중인 아이템:",
      "없는 아이템 이름",
      "Buyer 플레이어에게 다음 거래 아이템을 받습니다:",
      "플래티넘 x 3" + TAIL,
    ]);
    expect(parsed?.items.map((item) => item.displayName)).toEqual(["없는 아이템 이름"]);
  });

  it("keeps stack counts", () => {
    expect(englishTradeItemLine("라이플 엘리멘탈리스트 x 3")).toBe("Rifle Elementalist x 3");
    expect(englishTradeItemLine("플래티넘")).toBe("Platinum");
  });

  it("spells relic eras in English and keeps the code", () => {
    expect(englishTradeItemLine("액시 A15 성유물")).toBe("Axi A15 Relic");
    expect(englishTradeItemLine("리스 G1 유물 x 2")).toBe("Lith G1 Relic x 2");
    expect(englishTradeItemLine("레퀴엠 IV 성유물")).toBe("Requiem IV Relic");
    expect(englishTradeItemLine("메소 X9")).toBe("Meso X9 Relic");
    expect(localizedTradeItemName("Neo N14 Relic")).toBe("네오 N14 성유물");
  });

  it("leaves English lines alone", () => {
    expect(englishTradeItemLine("Vicious Bond (RARE RANK 0)")).toBe("Vicious Bond (RARE RANK 0)");
  });
});

describe("localizedTradeItemName", () => {
  it("shows the game-language name with rank and extra count", () => {
    expect(localizedTradeItemName("Titania Prime Blueprint")).toBe("티타니아 프라임 설계도");
    expect(localizedTradeItemName("Vital Sense (Rank 0)")).toBe("바이탈 센스 (0 랭크)");
    expect(localizedTradeItemName("Protea Prime Blueprint +1")).toBe("프로티아 프라임 설계도 +1");
    // The part and its blueprint share this English name; the blueprint's reads.
    expect(localizedTradeItemName("Protea Prime Systems Blueprint")).toBe(
      "프로티아 프라임 시스템 설계도",
    );
    expect(localizedTradeItemName("Not An Item")).toBe("Not An Item");
  });
});

describe("with a non-Korean game language", () => {
  let tmpDir = "";
  let trades: ParsedLogTrade[] = [];

  beforeEach(() => {
    setGameLocale("en");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "takover-ko-trade-"));
    hoisted.logPath = path.join(tmpDir, "EE.log");
    fs.writeFileSync(hoisted.logPath, "");
    trades = [];
    vi.useFakeTimers();
    startWatching({ onTradeConfirmed: (trade) => void trades.push(trade) });
  });

  afterEach(() => {
    stopWatching();
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setGameLocale("ko");
  });

  it("leaves the Korean dialog to the upstream parser, which ignores it", () => {
    fs.appendFileSync(hoisted.logPath, KO_SALES);
    forceEeLogPoll();
    expect(trades).toHaveLength(0);
  });

  it("does not translate Korean item lines", () => {
    expect(englishTradeItemLine("플래티넘 x 5")).toBe("플래티넘 x 5");
  });
});
