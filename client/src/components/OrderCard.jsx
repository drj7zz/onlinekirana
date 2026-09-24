import { Link } from 'react-router-dom';
import {
  Package, Check, ChefHat, Truck, Home, XCircle,
  MapPin, Phone, CalendarClock, Receipt,
} from 'lucide-react';

/**
 * Canonical order status metadata used across every role.
 * `step` is the position on the delivery timeline (cancelled is handled separately).
 */
export const ORDER_STEPS = [
  { key: 'pending', label: 'Placed', icon: Receipt, blurb: 'We received your order' },
  { key: 'confirmed', label: 'Confirmed', icon: Check, blurb: 'Your order is confirmed' },
  { key: 'packed', label: 'Packed', icon: ChefHat, blurb: 'Your items are packed' },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck, blurb: 'On the way to you' },
  { key: 'delivered', label: 'Delivered', icon: Home, blurb: 'Delivered to your door' },
];

export const STATUS_LABEL = {
  pending: 'Pending', confirmed: 'Confirmed', packed: 'Packed',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled',
};

const PAY_LABEL = { cod: 'Cash on delivery', esewa: 'eSewa' };

// Human-friendly order reference — never the raw internal id
export const orderRef = (id) => `#${String(id).slice(-6).toUpperCase()}`;

const statusIndex = (s) => ORDER_STEPS.findIndex((x) => x.key === s);

/** Horizontal delivery timeline — turns green up to the current step. */
function OrderProgress({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="order-progress cancelled">
        <span className="op-cancelled"><XCircle size={16} aria-hidden="true" /> This order was cancelled</span>
      </div>
    );
  }
  const current = statusIndex(status);
  return (
    <ol className="order-progress" aria-label={`Order status: ${STATUS_LABEL[status]}`}>
      {ORDER_STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        const Icon = step.icon;
        return (
          <li key={step.key} className={`op-step ${state}`}>
            <span className="op-dot"><Icon size={15} aria-hidden="true" /></span>
            <span className="op-label">{step.label}</span>
            {i < ORDER_STEPS.length - 1 && <span className="op-bar" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One order card for every role.
 * props:
 *   order        – the order object
 *   viewer       – 'customer' | 'merchant' | 'admin'
 *   onStatus     – (id, status) => void  (admin/merchant status control; omit to hide)
 *   allowedStatuses – optional list to limit the status dropdown
 *   compact      – tighter layout (dashboard lists)
 */
export default function OrderCard({ order, viewer = 'customer', onStatus, allowedStatuses, compact = false }) {
  const o = order;
  const total = Number(o.total).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const when = new Date(o.createdAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const itemCount = o.items.reduce((s, i) => s + i.qty, 0);
  const addr = o.deliveryAddress || {};

  return (
    <article className={`order-card${compact ? ' compact' : ''}`}>
      {/* header */}
      <header className="order-head">
        <div className="order-head-main">
          <span className="order-ref">Order {orderRef(o._id)}</span>
          <span className={`status s-${o.status}`}>{STATUS_LABEL[o.status] || 'Processing'}</span>
        </div>
        <div className="order-head-side">
          <strong className="order-total">रू {total}</strong>
          {viewer !== 'customer' && o.user && (
            <span className="order-customer">
              {o.user.name || 'Customer'}
              {o.user.phone ? ` · ${o.user.phone}` : o.user.email ? ` · ${o.user.email}` : ''}
            </span>
          )}
          {onStatus && (
            <select
              aria-label="Update order status"
              value={o.status}
              onChange={(e) => onStatus(o._id, e.target.value)}
            >
              {(allowedStatuses || Object.keys(STATUS_LABEL)).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* delivery timeline */}
      <OrderProgress status={o.status} />

      {/* items */}
      <div className="order-items">
        <div className="order-items-head">
          <span><Package size={14} aria-hidden="true" /> {o.items.length} item{o.items.length === 1 ? '' : 's'} · {itemCount} unit{itemCount === 1 ? '' : 's'}</span>
          <span className="muted"><CalendarClock size={13} aria-hidden="true" /> {when}</span>
        </div>
        <ul>
          {o.items.map((i, idx) => (
            <li key={idx}>
              <span className="oi-name">
                {i.product ? <Link to={`/product/${i.product}`} className="oi-link">{i.name}</Link> : i.name}
              </span>
              <span className="oi-qty">{i.qty} {i.unit}</span>
              <span className="oi-price">रू {(i.price * i.qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* delivery summary */}
      <footer className="order-foot">
        <p className="order-addr">
          <MapPin size={14} aria-hidden="true" />
          <span>
            {addr.line}{addr.ward ? `, Ward ${addr.ward}` : ''}, {addr.city || 'Birgunj'}
          </span>
        </p>
        <p className="order-meta">
          {addr.phone && <><Phone size={13} aria-hidden="true" /> {addr.phone}</>}
          <span className="order-pay">{PAY_LABEL[o.paymentMethod] || 'Cash on delivery'}</span>
        </p>
      </footer>
    </article>
  );
}