/**
 * Where the two apps live.
 *
 * OnlineKirana is split in two — the shopper storefront and the business portal
 * — and they link to each other constantly. Those two URLs were being redeclared
 * as a local `const` in a dozen files, which meant one forgotten copy quietly
 * pointed at the wrong app. They live here instead.
 *
 * No hardcoded hosts, and no throwing. Three rules, in order:
 *
 *   1. THIS app's own address comes from `window.location.origin`. It is
 *      literally the URL the visitor is on, so it can never be stale and never
 *      needs configuring — localhost in dev, the real domain once deployed.
 *
 *   2. The OTHER app is a different origin, so it must be told where it is
 *      (VITE_PARTNERS_URL / VITE_STOREFRONT_URL). If that is missing we guess
 *      the local dev sibling port, and failing that assume a single-host
 *      deployment where both apps sit on one domain.
 *
 *   3. Never throw. A missing variable used to throw at import time, which
 *      happened before React mounted and produced a blank white page with no
 *      console error and no failed request. A wrong link is recoverable and
 *      visible; a blank screen is not. `missingConfig()` reports the problem
 *      once, in the console, with the fix.
 *
 * Per environment (.env.development for dev, .env.production for builds, or the
 * Vercel/Render dashboard):
 *   client/     VITE_API_URL, optional VITE_PARTNERS_URL
 *   partners/   VITE_API_URL, optional VITE_STOREFRONT_URL
 */

/** Warn once per key — a missing variable is a bug, but not a fatal one. */
const warned = new Set();
const missingConfig = (key) => {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[config] ${key} is not set, so cross-app links fall back to a guessed URL. ` +
      'Set it in .env.development (local) or .env.production (build), or under ' +
      'Vercel -> Settings -> Environment Variables.'
  );
};

/** Trailing slashes would produce `//` when callers append a path. */
const clean = (v) => String(v).trim().replace(/\/+$/, '');

/** True for loopback origins, whatever port they carry. */
const isLocal = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

/** The origin this page is being served from. */
const selfOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return clean(window.location.origin);
  }
  // No window (SSR or a prerender step): fall back to the configured value.
  return clean(import.meta.env.VITE_STOREFRONT_URL || '');
};

/**
 * The other app's origin.
 *
 * `port` is the local dev port for that app, used only when we are running on
 * loopback — on a real host we must not invent a port, so a same-origin
 * deployment links to itself.
 */
const otherApp = (key, port) => {
  const configured = import.meta.env[key];
  if (configured) return clean(configured);

  missingConfig(key);
  const self = selfOrigin();
  if (isLocal(self)) {
    const base = self.replace(/:\d+$/, '');
    return `${base}:${port}`;
  }
  return self;
};

/** This app's own public address — always correct, never configured. */
export const SELF_URL = selfOrigin();

/** The partner portal — merchants, riders, operations. */
export const PORTAL_URL = otherApp('VITE_PARTNERS_URL', 5174);

/** The shopper storefront. */
export const STOREFRONT_URL = otherApp('VITE_STOREFRONT_URL', 5173);
