import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';

/** Fulfilling orders that contain this shop's items. */
export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);

  const load = () => API.get('/partner/orders').then((r) => setOrders(r.data)).catch(() => { });
  useLive(load, 8000, [user?._id]);

  const setOrderStatus = async (id, status) => { await API.patch(`/partner/orders/${id}/status`, { status }); load(); };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to see your orders.</p>;
  if (user.role !== 'merchant') return <p className="empty">Order fulfilment is for merchant partners only.</p>;

  return (
    <div>
      <h1>Orders</h1>
      <p className="muted">Orders containing your items. Pack them, then hand over to the delivery fleet.</p>

      {orders.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={32} aria-hidden="true" />
          <p>No orders with your items yet. When customers buy from your shop, their orders appear here with a delivery tracker.</p>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <OrderCard
              key={o._id}
              order={o}
              viewer="merchant"
              allowedStatuses={['packed', 'out_for_delivery', 'delivered']}
              onStatus={setOrderStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
