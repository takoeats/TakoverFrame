// Trade history stores the English name, the warframe.market join key. Show it in
// the game language, as every other item label does.

import { derived } from "svelte/store";

import {
  buildTradeNameIndex,
  localizedTradeItemName,
} from "../../../config/shared/takover/tradeNames.js";
import { itemDb } from "../../stores/data.js";

export const tradeItemLabel = derived(itemDb, ($itemDb) => {
  const index = buildTradeNameIndex($itemDb);
  return (displayName: string): string => localizedTradeItemName(displayName, index);
});
