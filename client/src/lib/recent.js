/**
 * Recently-viewed products, stored in localStorage (module-local helpers, no
 * react state — components that render the strip read the list on mount).
 *
 * Used by ProductDetail (to record a view) and Home (to show the strip). The
 * entry keeps only what a ProductCard needs to render, so the strip renders the
 * same card component as the main grid.
 */

const KEY = 'ok_recent_products';
const MAX = 8;

export function rememberProduct(product) {
  if (!product?._id) return;
  try {
    const entry = {
      _id: product._id,
      name: product.name,
      category: product.category,
      unit: product.unit,
      stock: product.stock,
      imageUrl: product.imageUrl || '',
      discountPercent: product.discountPercent || 0,
      price: product.price,
      merchant: product.merchant && typeof product.merchant === 'object'
        ? { _id: product.merchant._id, shopName: product.merchant.shopName, merchantStatus: product.merchant.merchantStatus }
        : product.merchant,
      ratingCount: product.ratingCount || 0,
      ratingAverage: product.ratingAverage || 0,
    };
    const rest = (readRecent().filter((p) => p._id !== product._id)).slice(0, MAX - 1);
    localStorage.setItem(KEY, JSON.stringify([entry, ...rest]));
  } catch { /* private mode — the strip just stays empty */ }
}

export function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((p) => p?._id) : [];
  } catch {
    return [];
  }
}

export function clearRecent() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
