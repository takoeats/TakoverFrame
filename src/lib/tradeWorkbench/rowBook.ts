import { fetchItemOrderBookBySlug } from "../wfm/orderBook.js";

interface BookTarget {
  slug: string;
  rank: number | null;
  subtype: string | null;
}

/** The books for one row; a relic row reads only its own refinement's orders.
 *  Rows load because the user pressed load, and the caller already spaces them,
 *  so they spend the interactive budget. */
export async function fetchRowBook(target: BookTarget) {
  const result = await fetchItemOrderBookBySlug(target.slug, {
    rank: target.rank,
    subtype: target.subtype,
    priority: "interactive",
  });
  return result.status === "ok" ? { sell: result.data.sell, buy: result.data.buy } : null;
}
