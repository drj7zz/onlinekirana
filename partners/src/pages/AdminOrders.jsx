import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageOpen, Search, Bike, Truck, ExternalLink,
} from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';
import { ORDER_STATUSES, DELIVERY_LABEL, money, timeAgo } from '@shared/lib/delivery';

const STATUSES = ORDER_STATUSES;

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

  return (
    <div className="order-note note-strip">
      <Bike size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
      <strong>{DELIVERY_LABEL[d.status] || d.status}</strong>
      <span className="muted"> · {money(d.fee)} fee{d.slot ? ` · promised ${d.slot}` : ''}</span>
      <p className="muted">
        {rider ? (
          <>
            Rider: <strong>{rider.name}</strong>
            {rider.phone && <> · {rider.phone}</>}
            {rider.riderVehicle && <> · {rider.riderVehicle}</>}
          </>
        ) : (
          'No rider on it yet — the auto-dispatcher is still looking for someone on shift.'
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

  const load = () =>
    API.get('/orders')
      .then((r) => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

  // live: new orders and rider movements appear automatically, no refresh
  useLive(load, 6000, [user?._id]);

  const setStatus = async (id, status) => {
    await API.patch(`/orders/${id}/status`, { status });
    load();
  };

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to manage orders.</p>;

  // Orders that need a person: a job is stuck without a rider, or a rider is on it.
  const inDelivery = (o) => o.delivery && !['delivered', 'failed'].includes(o.delivery.status);
  const needRider = orders.filter((o) => o.delivery?.status === 'pending' && !o.delivery.rider);
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
                No rider was on shift when these were packed. Approve or go on shift more riders,
                or assign one by hand.
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
