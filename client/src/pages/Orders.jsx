import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import OrderCard from '../components/OrderCard';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // live: order status changes stream in automatically
  useLive(() => {
    if (!user) return;
    API.get('/orders/mine')
      .then((r) => { setOrders(r.data); setError(''); })
      .catch(() => setError('We could not load your orders right now. Please try again in a moment.'))
      .finally(() => setLoading(false));
  }, 8000, [user?._id]);

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to see your orders.</p>;

  return (
    <div>
      <h1>My Orders</h1>
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
          {orders.map((o) => <OrderCard key={o._id} order={o} viewer="customer" />)}
        </div>
      )}
    </div>
  );
}
