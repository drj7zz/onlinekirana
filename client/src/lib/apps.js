/**
 * Where the two apps live.
 *
 * OnlineKirana is split in two — the shopper storefront and the business portal
 * — and they link to each other constantly. Those two URLs were being redeclared
 * as a local `const` in a dozen files, which meant one forgotten copy quietly
 * pointed at the wrong app. They live here instead.
 *
 * Both are required. There is deliberately no localhost fallback: a build with
 * the variable missing would otherwise ship links to http://localhost:5173 into
 * production, where they resolve to the visitor's own machine. Failing loudly at
 * startup is far better than a site whose every cross-app link is dead.
 *
 * Set them per environment in `.env.development` / `.env.production`:
 *   client/     VITE_API_URL, VITE_PARTNERS_URL, VITE_STOREFRONT_URL
 *   partners/   VITE_API_URL, VITE_STOREFRONT_URL
 */

const required = (key) => {
  const v = import.meta.env[key];
  if (!v) {
    throw new Error(
      `[config] ${key} is not set. Fill it in .env.development (local) or .env.production ` +
      '(build), or set it under Vercel -> Settings -> Environment Variables.'
    );
  }
  // strip a trailing slash so `${URL}/path` never produces a double slash
  return v.replace(/\/+$/, '');
};

/** The partner portal — merchants, riders, operations. */
export const PORTAL_URL = required('VITE_PARTNERS_URL');

/** The shopper storefront. */
export const STOREFRONT_URL = required('VITE_STOREFRONT_URL');
