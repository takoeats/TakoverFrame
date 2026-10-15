import type { SyndicateMeta, SyndicateNames } from "../../../config/shared/syndicateTypes.js";

/** Swaps in game-language names; anything the game has no name for stays English.
 *  `wikiPage` is left alone, the wiki only knows the English titles. */
export function localizeSyndicates(
  metas: readonly SyndicateMeta[],
  names: SyndicateNames,
): SyndicateMeta[] {
  return metas.map((meta) => {
    const local = names[meta.tag];
    if (!local) return meta;
    return {
      ...meta,
      name: local.name || meta.name,
      titles: meta.titles.map((title) => ({
        ...title,
        name: local.titles[String(title.level)] || title.name,
      })),
    };
  });
}
