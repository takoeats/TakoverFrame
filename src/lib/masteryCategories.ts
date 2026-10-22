import type { MessageKey, Translator } from "./i18n.js";

// Mastery categories are English data values (masteryHelper's PRODUCT_DISPLAY);
// the same word in the foundry shares its label.
const LABEL_KEYS: Record<string, MessageKey> = {
  Warframes: "mastery.category.warframes",
  Primary: "equipment.category.primary",
  Secondary: "equipment.category.secondary",
  Melee: "equipment.category.melee",
  Companions: "mastery.category.companions",
  Companion: "equipment.category.companion",
  Archwing: "equipment.category.archwing",
  Amps: "mastery.category.amps",
  Necramech: "mastery.category.necramech",
  Railjack: "mastery.category.railjack",
  Misc: "equipment.category.misc",
};

/** The display label of a mastery category, or the category itself when unknown. */
export function masteryCategoryLabel(category: string, t: Translator): string {
  const key = LABEL_KEYS[category];
  return key ? t(key) : category;
}
