import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { finalPrice, rupees } from '../lib/pricing';
import { Check, Minus, Plus, ShoppingCart, Trash2, Zap } from 'lucide-react';

/**
 * The buy control for a product.
 *
 * It has two states, driven by whether the product is already in the cart:
 *
 *   not in cart  →  "Add to cart", plus a "Buy now" shortcut
 *   in cart      →  a −/qty/+ stepper that updates the cart in place, so the
 *                   number you see is the real quantity that will be charged
 *
 * The stepper writes straight to the cart on every click, so there is no
 * separate "update" step and the count never drifts from what checkout will
 * use. It stops at the product's stock — the + is disabled on the last unit
 * and the quantity is clamped in the cart itself, not just here.
 *
 * `compact` is the card-sized variant on the product grid; the default is the
 * wider one used on the product page.
 */
export default function AddToCartButton({ product, compact = false, showBuyNow = false, initialQty = 1, className = '' }) {
  const { add, updateQty, remove, qtyOf } = useCart();
  const navigate = useNavigate();
  const inCart = qtyOf(product._id);
  const stock = Math.max(0, product.stock ?? 0);
  const price = finalPrice(product);
  // how many one tap should add — the product page passes its quantity picker
  const per = Math.max(1, Math.min(Number(initialQty) || 1, stock));

  if (stock <= 0) {
    return (
      <button className={`buy-btn buy-out${className ? ` ${className}` : ''}`} disabled>
        <ShoppingCart size={compact ? 15 : 17} aria-hidden="true" /> Out of stock
      </button>
    );
  }

  // not in the cart yet — one tap adds it
  if (!inCart) {
    return (
      <div className={`buy-cta${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
        <button
          type="button"
          className="buy-btn buy-add"
          onClick={() => add(product, per)}
        >
          <ShoppingCart size={compact ? 15 : 17} aria-hidden="true" />
          {per > 1 ? `Add ${per} to cart` : 'Add to cart'}
        </button>
        {/* Buy now adds this one item and goes straight to checkout, skipping
            the cart page for the "I know what I want" case. */}
        {showBuyNow && (
          <button
            type="button"
            className="buy-btn buy-now"
            onClick={() => { add(product, per); navigate('/checkout'); }}
          >
            <Zap size={compact ? 15 : 17} aria-hidden="true" /> Buy now
          </button>
        )}
      </div>
    );
  }

  // already in the cart — a live stepper, plus Buy now once there is a cart
  const atMax = inCart >= stock;
  return (
    <div className={`buy-group${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      <div className="buy-stepper">
        <button
          type="button"
          onClick={() => (inCart <= 1 ? remove(product._id) : updateQty(product._id, inCart - 1))}
          aria-label={inCart <= 1 ? `Remove ${product.name} from cart` : `Decrease ${product.name} quantity`}
        >
          {inCart <= 1 ? <Trash2 size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
        </button>

        <span className="buy-stepper-qty" aria-live="polite">
          <span className="sr-only">{product.name} quantity in cart: </span>{inCart}
        </span>

        <button
          type="button"
          onClick={() => updateQty(product._id, inCart + 1)}
          disabled={atMax}
          aria-label={`Increase ${product.name} quantity`}
          title={atMax ? `Only ${stock} in stock` : undefined}
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>

      {!compact && (
        <span className="buy-stepper-total" aria-label={`Line total ${rupees(price * inCart)}`}>
          <Check size={13} aria-hidden="true" /> {rupees(price * inCart)}
        </span>
      )}

      {showBuyNow && (
        <button type="button" className="buy-btn buy-now" onClick={() => navigate('/checkout')}>
          <Zap size={compact ? 15 : 17} aria-hidden="true" /> Buy now
        </button>
      )}
    </div>
  );
}
