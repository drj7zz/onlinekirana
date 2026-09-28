import { createContext, useContext, useMemo, useState } from 'react';
import { finalPrice } from '../lib/pricing';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // [{ product, qty }]

  // A new item is capped at what the shop actually has in stock, and `add`
  // returns the resulting quantity so the caller can update its own stepper
  // without a second round-trip through state.
  const add = (product, qty = 1) => {
    const cap = Math.max(1, product.stock || 1);
    let next = 0;
    setItems((prev) => {
      const found = prev.find((i) => i.product._id === product._id);
      if (found) {
        const bumped = Math.min(found.qty + qty, cap);
        next = bumped;
        return prev.map((i) => (i.product._id === product._id ? { ...i, qty: bumped } : i));
      }
      const fresh = Math.min(qty, cap);
      next = fresh;
      return [...prev, { product, qty: fresh }];
    });
    return next;
  };

  // Clamped to stock so a typed or stepped quantity can never exceed what is
  // actually on the shelf — the server re-checks this at checkout regardless.
  const updateQty = (id, qty) =>
    setItems((prev) => prev.map((i) => {
      if (i.product._id !== id) return i;
      const cap = Math.max(1, i.product.stock || 1);
      return { ...i, qty: Math.min(Math.max(1, Number(qty) || 1), cap) };
    }));

  const remove = (id) => setItems((prev) => prev.filter((i) => i.product._id !== id));
  const clear = () => setItems([]);

  /** How many of this product are already in the cart (0 when not in it). */
  const qtyOf = (id) => items.find((i) => i.product._id === id)?.qty || 0;

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  // priced through the shared helper, so the cart total can never disagree with
  // the price shown on the card, the product page or the search suggestion
  const total = useMemo(() => items.reduce((s, i) => s + finalPrice(i.product) * i.qty, 0), [items]);

  // a product that has since gone out of stock must not stay purchasable
  const unavailable = useMemo(
    () => items.filter((i) => (i.product.stock ?? 0) <= 0).map((i) => i.product._id),
    [items],
  );

  return (
    <CartContext.Provider value={{ items, add, updateQty, remove, clear, count, total, qtyOf, unavailable }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
