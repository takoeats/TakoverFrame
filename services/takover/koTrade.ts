// Korean-client glue for the trade log. The game writes the trade confirmation
// dialog to EE.log in the client language, so the English parser sees
// nothing. On the Korean client only, these turn the dialog into the English shape
// it reads, item names included: English stays the join key for warframe.market.

import type { ParsedLogTrade } from "../eeLogMonitor";
import { getRendererLookup } from "../itemDatabase";
import { isKoreanClient } from "./koLocale";
import { KO_TRADE_SUCCESS } from "../../config/shared/takover/koLogLines";
import {
  buildTradeNameIndex,
  englishTradeItemName,
  localizedTradeItemName as localizedName,
  type TradeNameIndex,
} from "../../config/shared/takover/tradeNames";

const KO_DIALOG_START = "이 거래를 수락하시겠습니까?";
const KO_OFFERING = "현재 제시중인 아이템:";
const KO_RECEIVING = /([^\s]+)\s*플레이어에게 다음 거래 아이템을 받습니다:/;
const KO_PLATINUM = "플래티넘";

const HANGUL = /[가-힣]/;
const STACK_SUFFIX = /^(.+?)\s+x\s+(\d+)$/i;

/** Where the dialog starts on this line, in either client language; -1 if absent. */
export function findTradeDialogStart(line: string, english: string): number {
  const at = line.indexOf(english);
  return at >= 0 || !isKoreanClient() ? at : line.indexOf(KO_DIALOG_START);
}

export function isTradeSuccessLine(line: string, english: string): boolean {
  return line.includes(english) || (isKoreanClient() && line.includes(KO_TRADE_SUCCESS));
}

/** The dialog's two block headers in English; the item lines go through
 *  {@link englishTradeItemLine} one by one. */
export function englishTradeDialog(text: string): string {
  if (!isKoreanClient() || !text.includes(KO_OFFERING)) return text;
  return text
    .replace(KO_OFFERING, "You are offering:")
    .replace(
      KO_RECEIVING,
      (_whole, partner: string) => `and will receive from ${partner} the following:`,
    );
}

/** One item line in its English form, platinum and stack counts included. A name
 *  the dictionary cannot place stays Korean, so the trade still records. */
export function englishTradeItemLine(line: string): string {
  if (!isKoreanClient() || !HANGUL.test(line)) return line;
  const trimmed = line.trim();
  const stack = STACK_SUFFIX.exec(trimmed);
  const name = stack ? stack[1].trim() : trimmed;
  const tail = stack ? ` x ${stack[2]}` : "";
  if (name === KO_PLATINUM) return `Platinum${tail}`;
  return `${englishTradeItemName(name, nameIndex()) ?? name}${tail}`;
}

// Cached per projection: getRendererLookup rebuilds it on a language or database
// change, so the index follows the game language.
let cached: { lookup: object; index: TradeNameIndex } | null = null;

function nameIndex(): TradeNameIndex {
  const lookup = getRendererLookup();
  if (cached?.lookup !== lookup) cached = { lookup, index: buildTradeNameIndex(lookup) };
  return cached.index;
}

export function localizedTradeItemName(english: string): string {
  return localizedName(english, nameIndex());
}

// The confirmation dialog, once per dialog, while the player can still decline.
// Each dialog gets a number; a listener's work is stale once that dialog settled
// or a newer one opened.
let dialogListener: ((trade: ParsedLogTrade, dialog: number) => void) | null = null;
let announcedBuffer: string[] | null = null;
let dialogNumber = 0;
let dialogOpen = false;

// DBWIN delivers the dialog live and the file poll re-delivers it up to ~26 s
// later; the echo is the same dialog, not a new one to warn about.
const ECHO_WINDOW_MS = 30_000;
let lastDialog: { content: string; stamp: string | null; at: number } | null = null;

function dialogContent(trade: ParsedLogTrade): string {
  const items = trade.items.map((i) => `${i.direction}:${i.displayName}:${i.count}`).sort();
  return [trade.type, trade.platChange, trade.partner.toLowerCase(), ...items].join("|");
}

function isEcho(trade: ParsedLogTrade, now: number): boolean {
  if (!lastDialog || lastDialog.content !== dialogContent(trade)) return false;
  const stamp = trade.logStamp ?? null;
  if (stamp !== null && lastDialog.stamp !== null) return stamp === lastDialog.stamp;
  return now - lastDialog.at <= ECHO_WINDOW_MS;
}

export function onTradeDialogOpen(
  listener: ((trade: ParsedLogTrade, dialog: number) => void) | null,
): void {
  dialogListener = listener;
}

/** Called on every log line while a sealed dialog is buffered; each buffer is
 *  a new dialog unless it echoes the last one, so it is announced once. */
export function announceTradeDialog(buffer: string[], parse: () => ParsedLogTrade | null): void {
  if (buffer === announcedBuffer) return;
  announcedBuffer = buffer;
  const trade = parse();
  const now = Date.now();
  if (trade && isEcho(trade, now)) return;
  if (trade) lastDialog = { content: dialogContent(trade), stamp: trade.logStamp ?? null, at: now };
  dialogNumber += 1;
  dialogOpen = true;
  if (trade && dialogListener) dialogListener(trade, dialogNumber);
}

/** The trade went through: the dialog's warning would now be too late. */
export function settleTradeDialog(): void {
  dialogOpen = false;
}

export function isTradeDialogPending(dialog: number): boolean {
  return dialogOpen && dialog === dialogNumber;
}
