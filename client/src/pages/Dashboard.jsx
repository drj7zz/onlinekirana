import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, ShoppingCart, ClipboardList, UserCircle2, ExternalLink } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import { useCart } from '../context/CartContext';
import OrderCard from '../components/OrderCard';
import { PORTAL_URL } from '../lib/apps';


const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);

const roleActions = {
  customer: [
    { to: '/', label: 'Shop groceries', icon: ShoppingCart, hint: 'Fresh sabzi, phalphul, chamal & more' },
    { to: '/orders', label: 'My orders', icon: ClipboardList, hint: 'Track your deliveries' },
    { to: '/profile', label: 'My profile & address', icon: UserCircle2, hint: 'Edit the default delivery info for orders' },
  ],
  merchant: [
    { to: '/', label: 'Shop groceries', icon: ShoppingCart, hint: 'Browse what other shops are selling' },
    { to: '/orders', label: 'My orders', icon: ClipboardList, hint: 'Track the orders you placed' },
    { to: PORTAL_URL, label: 'Manage my shop', icon: CircleCheck, hint: 'Products, orders and your shop page live in the partner portal' },
  ],
  delivery: [
    { to: '/', label: 'Shop groceries', icon: ShoppingCart, hint: 'Browse what is selling in your area' },
    { to: PORTAL_URL, label: 'My deliveries', icon: CircleCheck, hint: 'Shifts, jobs and earnings live in the partner portal' },
  ],
  admin: [
    { to: '/', label: 'Shop groceries', icon: ShoppingCart, hint: 'See the storefront as a shopper' },
    { to: PORTAL_URL, label: 'Operations desk', icon: CircleCheck, hint: 'Approvals, catalogue, orders and dispatch live in the partner portal' },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const { count } = useCart();
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
  const isShopper = user.role === 'customer';

  return (
    <div>
      <h1>{isShopper ? 'My Dashboard' : 'OnlineKirana'} {live}</h1>
      <p className="muted">
        Namaste, {user.name}! {isShopper ? ` Cart: ${count} item(s).` : 'Your workspace lives in the partner portal.'}
        {user.role === 'merchant' && user.shopName && ` Shop: ${user.shopName}.`}
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
            a.to.startsWith('http') ? (
              <a key={a.label} href={a.to} target="_blank" rel="noreferrer" className="action-row">
                <strong><a.icon size={17} className="action-icon" aria-hidden="true" />{a.label} <ExternalLink size={13} aria-hidden="true" /></strong>
                <span className="muted">{a.hint}</span>
              </a>
            ) : (
              <Link key={a.label} to={a.to} className="action-row">
                <strong><a.icon size={17} className="action-icon" aria-hidden="true" />{a.label}</strong>
                <span className="muted">{a.hint}</span>
              </Link>
            )
          ))}
        </div>
        <div>
          <h2>Recent orders</h2>
          {data.recentOrders.length === 0 && <p className="empty">Nothing yet.</p>}
          <div className="order-list">
            {data.recentOrders.map((o) => (
              <OrderCard key={o._id} order={o} viewer={user.role} compact showOtp={isShopper} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
