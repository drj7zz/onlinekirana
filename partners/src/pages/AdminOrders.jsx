import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageOpen, Search, Bike, Truck, ExternalLink, ClipboardList, Table2, LayoutList,
} from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';
import { DELIVERY_LABEL, DELIVERY_WINDOW_LABEL, money, timeAgo } from '@shared/lib/delivery';
import WorkspaceHeader from '../components/WorkspaceHeader.jsx';

const STATUSES = ['cancelled'];

/** Filter chips. `delivery` is the bucket that answers "where is my order?". */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'delivery', label: 'In delivery' },
  { key: 'assigned', label: 'Rider assigned' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** The one-line "what is happening with this order" strip. */
function DeliveryStrip({ order }) {
  const d = order.delivery;
  if (!d) return null;
  const rider = d.rider;
  const releasedToRiders = ['packed', 'assigned', 'out_for_delivery'].includes(order.status);

  return (
    <div className="order-note note-strip">
      <Bike size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
      <strong>{releasedToRiders ? (DELIVERY_LABEL[d.status] || d.status) : 'Waiting for shop to pack'}</strong>
      <span className="muted"> · {Number(d.fee || 0) === 0 ? 'Free delivery' : money(d.fee)}{d.slot ? ` · ${DELIVERY_WINDOW_LABEL[d.slot] || d.slot}` : ''}</span>
      <p className="muted">
        {rider ? (
          <>
            Rider: <strong>{rider.name}</strong>
            {rider.phone && <> · {rider.phone}</>}
            {rider.riderVehicle && <> · {rider.riderVehicle}</>}
          </>
        ) : (
          releasedToRiders
            ? 'Waiting for an on-shift rider to choose this delivery.'
            : 'The shop is preparing this order. Riders can choose it after it is packed.'
        )}
        {d.dropoff?.name && <> · dropping to {d.dropoff.name}</>}
      </p>
    </div>
  );
}

/** Compact row used in the "needs attention" queues. */
function JobLine({ order, job, to }) {
  return (
    <Link to={to} className="action-row">
      <strong>
        <Bike size={15} className="action-icon" aria-hidden="true" />
        Order #{String(order._id).slice(-6).toUpperCase()}
        <span className="muted" style={{ fontWeight: 400 }}>
          {' '}· {order.user?.name || 'Customer'} · {money(order.grandTotal)} · {timeAgo(order.createdAt)}
        </span>
      </strong>
      <span className="muted">
        {DELIVERY_LABEL[job.status] || job.status}
        {job.rider ? ` — ${job.rider.name}` : ' — no rider yet'}
        {job.dropoff?.ward && ` · Ward ${job.dropoff.ward}`}
      </span>
    </Link>
  );
}

/**
 * The supervisor's dense table: one row per order, every column the desk needs.
 * Tap a row to expand its full detail beneath it (items, address, rider).
 */
function OrdersTable({ orders, expanded, onToggle, onStatus }) {
  return (
    <div className="audit-table-wrap admin-orders-table-wrap">
      <table className="table admin-orders-table">
        <thead>
          <tr>
            <th>Order</th><th>Customer</th><th>Items</th><th>Total</th>
            <th>Status</th><th>Rider</th><th>Placed</th><th>Ward</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const id = String(o._id).slice(-6).toUpperCase();
            const rider = o.delivery?.rider;
            const open = expanded === o._id;
            return (
              <FragmentRow
                key={o._id}
                order={o}
                id={id}
                rider={rider}
                open={open}
                onToggle={() => onToggle(open ? null : o._id)}
                onStatus={onStatus}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ order, id, rider, open, onToggle, onStatus }) {
  const count = (order.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  return (
    <>
      <tr className={open ? 'is-open' : ''} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td data-label="Order"><code>#{id}</code></td>
        <td data-label="Customer">{order.user?.name || 'Customer'}<br /><small className="muted">{order.deliveryAddress?.phone}</small></td>
        <td data-label="Items">{count}</td>
        <td data-label="Total">{money(order.grandTotal)}</td>
        <td data-label="Status"><span className={`status s-${order.status}`}>{order.status.replace(/_/g, ' ')}</span></td>
        <td data-label="Rider">{rider ? rider.name : <span className="muted">—</span>}</td>
        <td data-label="Placed">{timeAgo(order.createdAt)}</td>
        <td data-label="Ward">{order.deliveryAddress?.ward || '—'}</td>
      </tr>
      {open && (
        <tr className="admin-order-detail-row">
          <td colSpan={8}>
            <div className="admin-order-detail">
              <dl className="detail-grid">
                <div><dt>Delivery address</dt><dd>{[order.deliveryAddress?.line, order.deliveryAddress?.ward && `Ward ${order.deliveryAddress.ward}`, 'Birgunj'].filter(Boolean).join(', ')}</dd></div>
                <div><dt>Payment</dt><dd>{order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod}</dd></div>
                <div><dt>Delivery status</dt><dd>{DELIVERY_LABEL[order.delivery?.status] || '—'}</dd></div>
                <div><dt>Window</dt><dd>{order.delivery?.slot ? (DELIVERY_WINDOW_LABEL[order.delivery.slot] || order.delivery.slot) : '—'}</dd></div>
                {order.deliveryInstructions && <div className="detail-wide"><dt>Customer note</dt><dd>{order.deliveryInstructions}</dd></div>}
              </dl>
              {(order.items || []).length > 0 && (
                <ul className="admin-order-items">
                  {order.items.map((i, idx) => (
                     
                    <li key={idx}><span>{i.name}</span><span>{i.qty} {i.unit}</span><span>{money(i.price * i.qty)}</span></li>
                  ))}
                </ul>
              )}
              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                <button type="button" className="danger" onClick={() => onStatus(order._id, 'cancelled')}>Cancel order</button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [reviewingCustomer, setReviewingCustomer] = useState('');
  const [view, setView] = useState('table');
  const [expanded, setExpanded] = useState(null);

  const load = () =>
    API.get('/orders')
      .then((r) => { setOrders(r.data); setError(''); })
      .catch(() => setError('Orders could not be loaded. Check your connection and try again.'))
      .finally(() => setLoading(false));

  // live: new orders and rider movements appear automatically, no refresh
  useLive(load, 6000, [user?._id]);

  const setStatus = async (id, status) => {
    try {
      await API.patch(`/orders/${id}/status`, { status });
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not update the order.');
    }
  };

  const restoreCustomerOrdering = async (customerId) => {
    setReviewingCustomer(customerId); setError('');
    try {
      await API.patch(`/admin/partners/customers/${customerId}/order-restriction`, { clear: true });
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not restore this customer’s ordering.');
    } finally { setReviewingCustomer(''); }
  };

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to manage orders.</p>;

  // Orders that need a person: a job is stuck without a rider, or a rider is on it.
  const inDelivery = (o) => ['packed', 'assigned', 'out_for_delivery'].includes(o.status) && o.delivery && !['delivered', 'failed'].includes(o.delivery.status);
  const needRider = orders.filter((o) => o.status === 'packed' && o.delivery?.status === 'pending' && !o.delivery.rider);
  const onTheRoad = orders.filter((o) => o.delivery?.rider && !['delivered', 'failed'].includes(o.delivery.status));

  const q = query.trim().toLowerCase();
  const visible = orders.filter((o) => {
    if (filter === 'delivery' && !inDelivery(o)) return false;
    if (filter !== 'all' && filter !== 'delivery' && o.status !== filter) return false;
    if (!q) return true;
    return (
      String(o._id).toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q) ||
      (o.user?.phone || '').includes(q) ||
      (o.delivery?.rider?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        icon={ClipboardList}
        eyebrow="Operations workspace"
        title="Orders & deliveries"
        description="Every order, with the rider who is carrying it. Step in here when a job has nobody on it."
      />

      {/* the two queues that need a human */}
      {(needRider.length > 0 || onTheRoad.length > 0) && (
        <details className="workspace-disclosure" open>
          <summary><span><Truck size={17} aria-hidden="true" /> Live deliveries</span><small>{needRider.length} waiting · {onTheRoad.length} on the road</small></summary>
          <div className="workspace-disclosure-body">
            <div className="stat-grid">
              <div className={`stat-card${needRider.length ? ' accent' : ''}`}>
                <div className="stat-value">{needRider.length}</div>
                <div className="stat-label">Waiting for a rider</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{onTheRoad.length}</div>
                <div className="stat-label">Out with a rider</div>
              </div>
            </div>
            {needRider.length > 0 && (
              <div className="section" style={{ marginTop: '1rem' }}>
                <div className="workspace-section-heading">
                  <div><h2>Nobody on these yet</h2><p>Packed orders stay open until an on-shift rider accepts one. Approve more riders or invite the team to go on shift.</p></div>
                  <span className="workspace-count">{needRider.length}</span>
                </div>
                {needRider.map((o) => (
                  <JobLine key={o._id} order={o} job={o.delivery} to="/admin/delivery" />
                ))}
                <Link className="cta-btn" to="/admin/delivery" style={{ marginTop: '.6rem', display: 'inline-flex' }}>
                  Open the dispatch desk <ExternalLink size={15} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </details>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {/* search + filters */}
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? '' : 'muted-btn'}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="history-search"><Search size={16} aria-hidden="true" /><input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by order number, customer, phone or rider"
        aria-label="Search orders"
      /></label>

      {/* the supervisor can flip between the dense table and full cards */}
      <div className="chips" role="group" aria-label="View mode">
        <button className={view === 'table' ? '' : 'muted-btn'} onClick={() => setView('table')} aria-pressed={view === 'table'}>
          <Table2 size={15} aria-hidden="true" /> Table
        </button>
        <button className={view === 'cards' ? '' : 'muted-btn'} onClick={() => setView('cards')} aria-pressed={view === 'cards'}>
          <LayoutList size={15} aria-hidden="true" /> Cards
        </button>
      </div>

      {loading ? (
        <p className="loading-shimmer">Loading orders</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <p>{orders.length === 0 ? 'No orders have been placed yet.' : 'Nothing matches that search.'}</p>
        </div>
      ) : view === 'table' ? (
        <OrdersTable orders={visible} expanded={expanded} onToggle={setExpanded} onStatus={setStatus} />
      ) : (
        <div className="order-list">
          {visible.map((o) => (
            <div key={o._id}>
              {o.user?.orderRestrictedUntil && new Date(o.user.orderRestrictedUntil) > new Date() && (
                <p className="order-note cancel">
                  Ordering paused for {o.user.name} until {new Date(o.user.orderRestrictedUntil).toLocaleDateString()}.{' '}
                  <button type="button" disabled={reviewingCustomer === o.user._id} onClick={() => restoreCustomerOrdering(o.user._id)}>
                    {reviewingCustomer === o.user._id ? 'Restoring…' : 'Restore ordering'}
                  </button>
                </p>
              )}
              <OrderCard
                order={o}
                viewer="admin"
                allowedStatuses={STATUSES}
                onStatus={setStatus}
              />
              <DeliveryStrip order={o} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
