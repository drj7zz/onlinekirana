import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Trash2, Minus, Plus, ShoppingCart, PackageOpen,
  Truck, ShieldCheck, Tag, Sparkles, AlertTriangle,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSeo } from '../hooks/useSeo';
import { imageUrl } from '../api';
import { finalPrice, listPrice, discountBadge, savedOnLine, rupees as fmt } from '../lib/pricing';
import { productPath } from '../lib/productUrl';

/** Cheapest delivery the API will quote — used only to drive the progress bar. */
const FREE_DELIVERY_OVER = 1000;

/**
 * One cart line as a card rather than a table row: the photo, the name, the
 * unit, the live stock warning and a stepper that writes straight to the cart.
 * Cards stay readable on a phone, which a five-column table does not.
 */
function CartLine({ product, qty, updateQty, remove }) {
  const price = finalPrice(product);
  const stock = Math.max(0, product.stock ?? 0);
  const atMax = qty >= stock;
  const low = stock > 0 && stock <= 3;
  const off = discountBadge(product);
  const saved = savedOnLine(product, qty);
  const rupees = fmt;

  return (
    <li className={`cart-line${stock <= 0 ? ' is-dead' : ''}`}>
      <Link to={productPath(product)} className="cart-line-media">
        {product.imageUrl
          ? <img src={imageUrl(product.imageUrl)} alt={product.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : <span className="cart-line-media-empty"><ShoppingCart size={20} aria-hidden="true" /></span>}
        {off && <span className="cart-line-off">-{off}</span>}
      </Link>

      <div className="cart-line-body">
        <Link to={productPath(product)} className="cart-line-name">{product.name}</Link>
        <p className="cart-line-meta">
          <span>{product.category}</span>
          <span aria-hidden="true">·</span>
          <span>per {product.unit}</span>
        </p>
        <p className="cart-line-stock">
          {stock <= 0
            ? <span className="stock-out"><AlertTriangle size={12} aria-hidden="true" /> Out of stock — remove to check out</span>
            : low
              ? <span className="stock-low">Only {stock} left</span>
              : <span className="muted">{stock} in stock</span>}
        </p>
        {saved > 0 && <p className="cart-line-save">You save {rupees(saved)} on this line</p>}
      </div>

      <div className="cart-line-price">
        {off && <span className="strike">{rupees(listPrice(product))}</span>}
        <span className="cart-line-unit">{rupees(price)}</span>
      </div>

      <div className="cart-line-qty">
        <div className="buy-stepper is-compact">
          <button
            type="button"
            onClick={() => (qty <= 1 ? remove(product._id) : updateQty(product._id, qty - 1))}
            aria-label={qty <= 1 ? `Remove ${product.name}` : `Decrease ${product.name} quantity`}
          >
            {qty <= 1 ? <Trash2 size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
          </button>
          <span className="buy-stepper-qty" aria-live="polite">
            <span className="sr-only">{product.name} quantity: </span>{qty}
          </span>
          <button
            type="button"
            onClick={() => updateQty(product._id, qty + 1)}
            disabled={atMax}
            aria-label={`Increase ${product.name} quantity`}
            title={atMax ? `Only ${stock} in stock` : undefined}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
        <span className="cart-line-sub">{rupees(price * qty)}</span>
      </div>

      <button type="button" className="cart-line-remove" onClick={() => remove(product._id)} aria-label={`Delete ${product.name} from cart`}>
        <Trash2 size={17} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function Cart() {
  const { items, updateQty, remove, total, count, unavailable } = useCart();
  const navigate = useNavigate();

  useSeo({
    title: 'Your cart | OnlineKirana',
    description: 'Review the groceries in your OnlineKirana cart before checking out, with live stock and prices from local shops in Birgunj.',
    noindex: true, // a personal, empty-by-default page — nothing to rank
  });

  if (items.length === 0) {
    return (
      <div>
        <div className="page-head">
          <h1>Your cart</h1>
        </div>
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <strong>Your cart is khali</strong>
          <p>Nothing here yet. Browse the shelves and add what you need — stock and prices update as you go.</p>
          <Link to="/" className="cta-btn">Go shopping</Link>
        </div>
      </div>
    );
  }

  const goods = total;
  const fee = 0; // the API quotes the real ward-wise fee at checkout
  const payable = goods + fee;
  const blocked = unavailable.length > 0;

  // total saved across every discounted line, shown in the summary
  const saved = items.reduce((s, { product, qty }) => s + savedOnLine(product, qty), 0);
  const toFree = Math.max(0, FREE_DELIVERY_OVER - goods);
  const pct = Math.min(100, Math.round((goods / FREE_DELIVERY_OVER) * 100));
  const rupees = fmt;

  return (
    <div>
      <div className="page-head">
        <h1>Your cart</h1>
        <p>{count} item{count === 1 ? '' : 's'} from local shops across Birgunj.</p>
      </div>

      {blocked && (
        <p className="error cart-blocked">
          {unavailable.length} item{unavailable.length === 1 ? ' has' : 's have'} gone out of stock. Remove
          {unavailable.length === 1 ? ' it' : ' them'} to continue to checkout.
        </p>
      )}

      <div className="cart-layout">
        <ul className="cart-list">
          {items.map(({ product, qty }) => (
            <CartLine
              key={product._id}
              product={product}
              qty={qty}
              updateQty={updateQty}
              remove={remove}
            />
          ))}
        </ul>

        <aside className="cart-summary">
          <h2>Order summary</h2>

          {/* nudge toward the free-delivery threshold, with the real numbers */}
          <div className="cart-goal">
            <div className="cart-goal-text">
              {toFree > 0
                ? <><Truck size={14} aria-hidden="true" /> Add <strong>{rupees(toFree)}</strong> more for free delivery</>
                : <><Sparkles size={14} aria-hidden="true" /> <strong>Free delivery unlocked</strong></>}
            </div>
            <div className="cart-goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>

          <dl className="cart-sum-rows">
            <div><dt>Items ({count})</dt><dd>{rupees(goods)}</dd></div>
            {saved > 0 && <div className="cart-sum-save"><dt>Discounts</dt><dd>− {rupees(saved)}</dd></div>}
            <div><dt>Delivery</dt><dd className="muted">Calculated at checkout</dd></div>
          </dl>
          <div className="cart-sum-total">
            <span>Subtotal</span>
            <strong>{rupees(payable)}</strong>
          </div>
          <p className="cart-sum-note">Taxes included. Delivery is ward-wise and confirmed on the next step.</p>
          <button className="cta-btn cart-checkout" disabled={blocked} onClick={() => navigate('/checkout')}>
            Proceed to checkout <ArrowRight size={17} className="cta-arrow" aria-hidden="true" />
          </button>
          <Link to="/" className="muted cart-continue">Continue shopping</Link>

          <ul className="trust-strip cart-trust">
            <li><Truck size={15} aria-hidden="true" /> 30-minute delivery</li>
            <li><ShieldCheck size={15} aria-hidden="true" /> Cash on delivery</li>
            <li><Tag size={15} aria-hidden="true" /> Prices straight from the shop</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
