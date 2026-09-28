import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, XCircle, MapPin, Phone, CalendarClock,
  KeyRound, Bike, Eye, EyeOff, Store, Wallet,
} from 'lucide-react';
import API from '../api';
import { ORDER_STEPS, STATUS_LABEL, money } from '../lib/delivery';
import { productPath } from '../lib/productUrl';

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
 * The hand-over code. Only ever fetched for the logged-in buyer's own order,
 * and hidden by default so it can't be read over someone's shoulder.
 */
function DeliveryCode({ orderId }) {
  const [code, setCode] = useState(null);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    API.get(`/delivery/orders/${orderId}/code`)
      .then(({ data }) => { if (alive) setCode(data); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [orderId]);

  if (failed || !code) return null;

  return (
    <div className="otp-chip">
      <KeyRound size={15} aria-hidden="true" />
      <span className="otp-body">
        <span className="otp-label">Hand-over code</span>
        <span className="otp-value">{shown ? code.otp : '••••'}</span>
      </span>
      <button
        type="button"
        className="muted-btn"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide hand-over code' : 'Show hand-over code'}
      >
        {shown ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </button>
      {code.slotLabel && <span className="otp-slot">{code.slotLabel}</span>}
    </div>
  );
}

/**
 * One order card for every role.
 * props:
 *   order           – the order object
 *   viewer          – 'customer' | 'merchant' | 'admin'
 *   onStatus        – (id, status) => void  (status control; omit to hide)
 *   allowedStatuses – optional list to limit the status dropdown
 *   compact         – tighter layout (dashboard lists)
 *   showOtp         – show the hand-over code (the buyer's own order)
 *   rider           – populated rider object, when the caller already has it
 */
export default function OrderCard({
  order, viewer = 'customer', onStatus, allowedStatuses, compact = false, showOtp = false, rider = null,
}) {
  const o = order;
  const total = money(o.grandTotal ?? o.total);
  const goods = Number(o.total || 0);
  const fee = Number(o.deliveryFee || 0);
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
          {o.paymentStatus === 'paid' && <span className="paid-chip">Paid</span>}
          {o.paymentStatus === 'refunded' && <span className="refund-chip">Refunded</span>}
        </div>
        <div className="order-head-side">
          <strong className="order-total">{total}</strong>
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

      {/* who is bringing it */}
      {rider && !compact && (
        <p className="order-rider">
          <Bike size={14} aria-hidden="true" />
          <span>
            Delivering now: <strong>{rider.name}</strong>
            {rider.phone && <> · <a href={`tel:${rider.phone}`}>{rider.phone}</a></>}
            {rider.riderVehicle && <> · {rider.riderVehicle}</>}
          </span>
        </p>
      )}

      {showOtp && !['delivered', 'cancelled'].includes(o.status) && <DeliveryCode orderId={o._id} />}

      {/* items */}
      <div className="order-items">
        <div className="order-items-head">
          <span><Package size={14} aria-hidden="true" /> {o.items.length} item{o.items.length === 1 ? '' : 's'} · {itemCount} unit{itemCount === 1 ? '' : 's'}</span>
          <span className="muted"><CalendarClock size={13} aria-hidden="true" /> {when}</span>
        </div>        <ul>
          {o.items.map((i, idx) => (
            <li key={idx}>
              <span className="oi-thumb" aria-hidden="true"><Store size={13} /></span>
              <span className="oi-name">
                {/* an order line stores only the id and the name it was bought
                    under, so the path is built from those two — the slug comes
                    from the recorded name, which may since have been renamed. */}
                {i.product ? <Link to={productPath({ _id: i.product, name: i.name })} className="oi-link">{i.name}</Link> : i.name}
              </span>
              <span className="oi-qty">× {i.qty} <small>{i.unit}</small></span>
              <span className="oi-price">{money(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="order-bill">
          <span>Items</span><span>{money(goods)}</span>
          <span>Delivery</span><span>{fee === 0 ? 'Free' : money(fee)}</span>
          <span className="order-bill-total">Total</span>
          <span className="order-bill-total">{total}</span>
        </div>
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
          <span className="order-pay">
            <Wallet size={12} aria-hidden="true" /> {PAY_LABEL[o.paymentMethod] || 'Cash on delivery'}
          </span>
        </p>
      </footer>

      {o.deliveryInstructions && (
        <p className="order-note"><strong>Note for the rider:</strong> {o.deliveryInstructions}</p>
      )}
      {o.cancelReason && (
        <p className="order-note cancel"><strong>Why it was cancelled:</strong> {o.cancelReason}</p>
      )}
    </article>
  );
}