import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Wishlist / save-for-later. Stored locally (localStorage) — no server round
 * trip, works for guests, and survives reloads. Exposes toggle/has/list plus a
 * `count` for the nav badge.
 */
const WishlistContext = createContext(null);
const KEY = 'ok_wishlist';
const MAX = 60;

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && i._id).slice(0, MAX) : [];
  } catch { return []; }
};

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))); } catch { /* private mode */ }
  }, [items]);

  const toggle = useCallback((product) => {
    setItems((cur) => {
      const has = cur.some((i) => i._id === product._id);
      return has ? cur.filter((i) => i._id !== product._id) : [{
        _id: product._id, name: product.name, imageUrl: product.imageUrl,
        category: product.category, unit: product.unit, price: product.price,
        discountPercent: product.discountPercent, stock: product.stock,
        ratingAverage: product.ratingAverage, ratingCount: product.ratingCount,
        createdAt: product.createdAt,
      }, ...cur].slice(0, MAX);
    });
  }, []);

  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i._id !== id)), []);
  const has = useCallback((id) => items.some((i) => i._id === id), [items]);

  return (
    <WishlistContext.Provider value={{ items, toggle, remove, has, count: items.length, isFull: items.length >= MAX }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
