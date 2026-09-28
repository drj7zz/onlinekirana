/**
 * Pricing maths, in one place.
 *
 * The server exposes `price` (the listed price) and `discountPercent`, and
 * derives `finalPrice` from them. The derived value is a Mongoose *virtual*, so
 * it is silently dropped by `.toObject()` and by `.lean()` — two queries were
 * serving products with no `finalPrice` at all. The UI must therefore never
 * trust the field being present, or a discounted item quietly renders at full
 * price. Everything here recomputes from `price` + `discountPercent` and only
 * falls back to a supplied `finalPrice` when there is genuinely no discount.
 */

/**
 * Money rounded to 2 decimal places, matching the server.
 * The multiply happens BEFORE the round — `Math.round(n) * 100 / 100` would
 * collapse every amount to a whole number (80.75 -> 81), which is exactly the
 * kind of silent price drift this module exists to prevent.
 */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** True only for a real discount a shopper can see. */
export const hasDiscount = (p) => Number(p?.discountPercent) > 0;

/**
 * What the shopper actually pays per unit.
 * This is the single source of truth for every price on screen.
 */
export const finalPrice = (p) => {
  if (!p) return 0;
  if (hasDiscount(p)) return round2(Number(p.price) * (1 - Number(p.discountPercent) / 100));
  return round2(p.finalPrice ?? p.price);
};

/** List price, for the struck-through original. */
export const listPrice = (p) => round2(p?.price);

/** Absolute money saved on one unit. */
export const savedPerUnit = (p) => round2(Math.max(0, listPrice(p) - finalPrice(p)));

/** Absolute money saved across a line of `qty` units. */
export const savedOnLine = (p, qty) => round2(savedPerUnit(p) * (Number(qty) || 0));

/** "रू 80.75" — the display format used everywhere in the storefront. */
export const rupees = (n) => `रू ${round2(n).toFixed(2)}`;

/**
 * The discount badge, or null when there is nothing to badge. Returns a real
 * value derived from the same maths the price uses, so a badge can never claim
 * a different percentage than the price actually reflects.
 */
export const discountBadge = (p) => {
  if (!hasDiscount(p)) return null;
  const before = listPrice(p);
  const after = finalPrice(p);
  if (before <= 0 || after >= before) return null;
  return `${Math.round((1 - after / before) * 100)}%`;
};
