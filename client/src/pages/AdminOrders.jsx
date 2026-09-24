import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import OrderCard from '../components/OrderCard';

const STATUSES = ['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => API.get('/orders')
    .then((r) => setOrders(r.data))
    .catch(() => {})
    .finally(() => setLoading(false));
  // live: new orders appear automatically, no refresh
  useLive(load, 6000, [user?._id]);

  const setStatus = async (id, status) => {
    await API.patch(`/orders/${id}/status`, { status });
    load();
  };

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to manage orders.</p>;

  return (
    <div>
      <h1>All Orders</h1>
      {loading ? (
        <p className="loading-shimmer">Loading orders</p>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <p>No orders have been placed yet.</p>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <OrderCard key={o._id} order={o} viewer="admin" allowedStatuses={STATUSES} onStatus={setStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
