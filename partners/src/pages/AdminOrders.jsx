import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageOpen, Search, Bike, Truck, ExternalLink,
} from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';
import { DELIVERY_LABEL, DELIVERY_WINDOW_LABEL, money, timeAgo } from '@shared/lib/delivery';

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

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [reviewingCustomer, setReviewingCustomer] = useState('');

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
    <div>
      <div className="page-head">
        <h1>Orders &amp; deliveries</h1>
        <p>
          Every order, with the rider who is carrying it. The dispatch desk is where you step in
          when a job has nobody on it.
        </p>
      </div>

      {/* the two queues that need a human */}
      {(needRider.length > 0 || onTheRoad.length > 0) && (
        <div className="card-panel">
          <h2><Truck size={18} className="action-icon" aria-hidden="true" /> Live deliveries</h2>
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
            <div className="section" style={{ marginTop: '1.2rem' }}>
              <h2>Nobody on these yet</h2>
              <p className="section-sub">
                These packed orders remain open until an on-shift rider chooses to accept. Approve more riders
                or invite the delivery team to go on shift.
              </p>
              {needRider.map((o) => (
                <JobLine key={o._id} order={o} job={o.delivery} to="/admin/delivery" />
              ))}
              <Link className="cta-btn" to="/admin/delivery" style={{ marginTop: '.6rem', display: 'inline-flex' }}>
                Open the dispatch desk <ExternalLink size={15} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {/* search + filters */}
      <div className="search-wrap list-search">
        <Search size={16} className="search-icon" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by order number, customer, phone or rider"
          aria-label="Search orders"
        />
      </div>
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

      {loading ? (
        <p className="loading-shimmer">Loading orders</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <p>{orders.length === 0 ? 'No orders have been placed yet.' : 'Nothing matches that search.'}</p>
        </div>
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
