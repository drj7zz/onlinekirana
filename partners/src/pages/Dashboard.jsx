import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Package, ReceiptText, PlusCircle, Truck, Bike, Store } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);

const roleTitle = {
  admin: 'Admin Dashboard',
  merchant: 'Partner Dashboard',
  delivery: 'Delivery Dashboard',
};

const roleActions = {
  admin: [
    { to: '/admin/partners', label: 'Approvals & partners', icon: CircleCheck, hint: 'Review product submissions and partner applications' },
    { to: '/admin/products', label: 'Manage products', icon: Package, hint: 'Full product catalogue control' },
    { to: '/admin/orders', label: 'All orders', icon: ReceiptText, hint: 'Oversee and update every order' },
    { to: '/admin/delivery', label: 'Dispatch desk', icon: Truck, hint: 'Unassigned deliveries and the rider fleet' },
  ],
  merchant: [
    { to: '/shop-setup', label: 'Shop setup', icon: Store, hint: 'Update your public shop page' },
    { to: '/products', label: 'Add / update products', icon: PlusCircle, hint: 'Manage your product listings' },
    { to: '/orders', label: 'Fulfil orders', icon: Truck, hint: 'Pack and mark deliveries' },
  ],
  delivery: [
    { to: '/rider', label: 'My deliveries', icon: Bike, hint: 'Pick up jobs and mark your drops' },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useLive(() => {
    if (!user) return;
    API.get('/dashboard')
      .then((r) => { setData(r.data); setError(''); })
      .catch(() => setError('We could not load your dashboard right now. Please try again in a moment.'));
  }, user?.role === 'admin' ? 6000 : 10000, [user?._id]);
  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to view your dashboard.</p>;
  if (error) return <p className="empty">{error}</p>;
  if (!data) return <p className="loading-shimmer">Loading your dashboard</p>;

  const live = <span className="live-dot" title="Updates automatically" />;

  return (
    <div>
      <h1>{roleTitle[user.role] || 'Dashboard'} {live}</h1>
      <p className="muted">
        Namaste, {user.name}! {user.role === 'admin' && 'You see everything the moment it happens.'}
        {user.role === 'merchant' && user.shopName && ` Shop: ${user.shopName}.`}
        {user.role === 'delivery' && 'Your route updates as jobs come in.'}
      </p>

      <div className="stat-grid">
        {data.cards.map((c) => (
          <div key={c.key} className={`stat-card${c.accent ? ' accent' : ''}`}>
            <div className="stat-value">{fmt(c.value)}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols">
        <div>
          <h2>Quick actions</h2>
          {roleActions[user.role]?.map((a) => (
            <Link key={a.label} to={a.to} className="action-row">
              <strong><a.icon size={17} className="action-icon" aria-hidden="true" />{a.label}</strong>
              <span className="muted">{a.hint}</span>
            </Link>
          ))}
        </div>
        <div>
          <h2>Recent orders</h2>
          {data.recentOrders.length === 0 && <p className="empty">Nothing yet.</p>}
          <div className="order-list">
            {data.recentOrders.map((o) => (
              <OrderCard key={o._id} order={o} viewer={user.role} compact showOtp={user.role === 'customer'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
