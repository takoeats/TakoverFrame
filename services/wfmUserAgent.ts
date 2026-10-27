import { app } from "electron";

import { APP_HOMEPAGE_URL, APP_PRODUCT_NAME } from "../config/shared/appMeta";

// `app` is undefined under plain node (tests, scripts), hence the optional calls.

/** The named User-Agent WFM's client rules ask for: product, version, contact. */
export function wfmUserAgent(): string {
  return `${APP_PRODUCT_NAME}/${app?.getVersion() ?? "0.0.0"} (+${APP_HOMEPAGE_URL})`;
}

/** Chromium's UA as Electron builds it. It names the app and Electron, and it
 *  matches the TLS fingerprint the Chromium transport presents. */
export function wfmChromiumUserAgent(): string {
  return app?.userAgentFallback || wfmUserAgent();
}
