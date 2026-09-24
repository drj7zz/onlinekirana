import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // [{ product, qty }]

  const add = (product, qty = 1) =>
    setItems((prev) => {
      const found = prev.find((i) => i.product._id === product._id);
      if (found) return prev.map((i) => i.product._id === product._id ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i);
      return [...prev, { product, qty }];
    });

  const updateQty = (id, qty) =>
    setItems((prev) => prev.map((i) => (i.product._id === id ? { ...i, qty: Math.max(1, qty) } : i)));

  const remove = (id) => setItems((prev) => prev.filter((i) => i.product._id !== id));
  const clear = () => setItems([]);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const total = useMemo(() => items.reduce((s, i) => {
    const price = i.product.finalPrice ?? i.product.price;
    return s + price * i.qty;
  }, 0), [items]);

  return (
    <CartContext.Provider value={{ items, add, updateQty, remove, clear, count, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
