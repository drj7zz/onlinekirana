import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, ShoppingBag, Radio, XCircle, Layers } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { useSeo } from '../hooks/useSeo';
import OrderCard from '../components/OrderCard';

/** How far an order has got, for the "what's happening" counters. */
const isLive = (o) => !['delivered', 'cancelled'].includes(o.status);
const isDone = (o) => o.status === 'delivered';
const isDead = (o) => o.status === 'cancelled';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState(null);

  // live: order status changes stream in automatically
  const load = () => {
    if (!user) return;
    API.get('/orders/mine')
      .then((r) => { setOrders(r.data); setError(''); })
      .catch(() => setError('We could not load your orders right now. Please try again in a moment.'))
      .finally(() => setLoading(false));
    API.get('/orders/cancellation-status').then(({ data }) => setCancellationPolicy(data)).catch(() => {});
  };
  useLive(load, 8000, [user?._id]);

  const cancelOrder = async (id) => {
    if (!window.confirm('Cancel this order? If the shop has already packed it, this counts toward the pilot cancellation limit.')) return;
    setError('');
    try {
      const { data } = await API.post(`/orders/${id}/cancel`, { reason: 'Cancelled by customer' });
      if (data.cancellation) setCancellationPolicy((current) => ({ ...current, ...data.cancellation, enabled: true }));
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not cancel this order. Contact support if you need help.');
    }
  };

  useSeo({
    title: 'My orders | OnlineKirana',
    description: 'Track every OnlineKirana order from packed to delivered, with live status updates and your hand-over code.',
    noindex: true,
  });

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to see your orders.</p>;

  // counters: what is on the way, what is done, what went wrong
  const counts = {
    live: orders.filter(isLive).length,
    done: orders.filter(isDone).length,
    dead: orders.filter(isDead).length,
  };
  // newest first, and anything still in progress floats to the top
  const sorted = [...orders].sort((a, b) => {
    const l = isLive(b) - isLive(a);
    return l !== 0 ? l : new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div>
      <div className="page-head">
        <h1>My orders</h1>
        <p>Live status — every order updates here on its own, no refresh needed.</p>
      </div>
      {cancellationPolicy?.enabled && cancellationPolicy.warning && <p className="order-note cancel" role="status">You have {cancellationPolicy.recentCount} qualifying cancellations in the last {cancellationPolicy.windowDays} days. {cancellationPolicy.limit} pauses ordering for {cancellationPolicy.restrictionDays} days.</p>}
      {cancellationPolicy?.restrictedUntil && <p className="order-note cancel" role="alert">Ordering is paused until {new Date(cancellationPolicy.restrictedUntil).toLocaleDateString()}. Contact support to request a review.</p>}

      {/* at-a-glance counters, so a shopper does not have to scan every card */}
      {orders.length > 0 && (
        <ul className="order-stats">
          <li className="order-stat is-live">
            <Radio size={16} aria-hidden="true" />
            <span><strong>{counts.live}</strong> on the way</span>
          </li>
          <li className="order-stat is-done">
            <ShoppingBag size={16} aria-hidden="true" />
            <span><strong>{counts.done}</strong> delivered</span>
          </li>
          {counts.dead > 0 && (
            <li className="order-stat is-dead">
              <XCircle size={16} aria-hidden="true" />
              <span><strong>{counts.dead}</strong> cancelled</span>
            </li>
          )}
          <li className="order-stat">
            <Layers size={16} aria-hidden="true" />
            <span><strong>{orders.length}</strong> all time</span>
          </li>
        </ul>
      )}

      {loading ? (
        <p className="loading-shimmer">Loading your orders</p>
      ) : error ? (
        <p className="empty">{error}</p>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <p>You haven&apos;t placed any orders yet. Once you do, you can follow every step from packed to delivered right here.</p>
          <Link to="/" className="cta-btn">Start shopping</Link>
        </div>
      ) : (
        <div className="order-list">
          {sorted.map((o) => <OrderCard key={o._id} order={o} viewer="customer" rider={o.delivery?.rider} showOtp onCancel={cancellationPolicy?.enabled ? cancelOrder : undefined} />)}
        </div>
      )}
    </div>
  );
}
