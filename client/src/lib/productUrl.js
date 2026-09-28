/**
 * URL helpers for products.
 *
 * A product's canonical address is its name, not its database id:
 *
 *   /product/chino-eggs-6ab9ceeabb4090cfa1c8cb1b
 *
 * The readable part is what ranks in search and what a shopper recognises, and
 * it stays a valid link forever even if the product is renamed — the trailing
 * id is still there, so the page resolves by id alone and never depends on the
 * slug matching. The slug is therefore cosmetic-but-stable, not a lookup key.
 *
 * Links are built here rather than inline so the same rule applies to the
 * product page, the cards, the search suggestions, the cart and the orders.
 */

/** Turn a product name into a URL fragment: lowercase, ascii, dash-joined. */
export const slugify = (name) =>
  String(name || '')
    .toLowerCase()
    // Nepali/Devanagari and other non-latin characters are dropped rather than
    // percent-encoded, so the URL stays readable instead of turning to %E0%A4…
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/** Keep the slug short — the id already makes the URL unique. */
const MAX_SLUG = 60;

/**
 * The canonical product path. Falls back to the bare id when a product has no
 * usable name (e.g. a name made entirely of non-latin characters), so the link
 * is never empty.
 */
export const productPath = (product) => {
  if (!product) return '/';
  const id = product._id || product.id || '';
  const slug = slugify(product.name).slice(0, MAX_SLUG).replace(/-$/, '');
  return slug ? `/product/${slug}-${id}` : `/product/${id}`;
};

/** The id out of a product path, whether it is a bare id or a slugged one. */
export const productIdFromPath = (segment) => {
  if (!segment) return '';
  // a Mongo id is 24 hex chars; anything longer is a slug followed by the id
  const hex = String(segment).match(/[0-9a-f]{24}$/i);
  return hex ? hex[0] : String(segment);
};
