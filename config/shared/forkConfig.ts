// TakoverFrame fork settings. Everything that differs from upstream WFHelper by
// policy rather than by code lives here, so an upstream merge touches one file.

/** Upstream's /v1/feedback posts into WFHelper's Discord, which is not ours to fill.
 *  The fork is private and has no public issue tracker either. */
export const BACKEND_FEEDBACK_ENABLED = false;
