import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Package, ReceiptText, Truck, Bike, Store, Boxes, ChevronRight, ShieldCheck, ChevronDown, Activity } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';
import WorkspaceHeader from '../components/WorkspaceHeader.jsx';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : n);

const roleTitle = {
  admin: 'Admin Dashboard',
  merchant: 'Partner Dashboard',
  delivery: 'Delivery Dashboard',
};

const roleIcon = {
  admin: ShieldCheck,
  merchant: Store,
  delivery: Bike,
};

const roleActions = {
  admin: [
    { title: 'Approve', actions: [
      { to: '/admin/partners', label: 'All approvals', icon: CircleCheck, hint: 'Review shop, rider and product applications' },
      { to: '/admin/integrations', label: 'Integration health', icon: Activity, hint: 'Check email, Cloudinary and Redis connectivity' },
      { to: '/admin/analytics', label: 'Analytics', icon: Activity, hint: 'Repeat rate, delays, stock refill and reviews' },
    ] },
    { title: 'View operations', actions: [
      { to: '/admin/orders', label: 'Orders', icon: ReceiptText, hint: 'Review and update customer orders' },
      { to: '/admin/delivery', label: 'Delivery desk', icon: Truck, hint: 'Open jobs and rider fleet' },
    ] },
    { title: 'Manage catalogue', actions: [
      { to: '/admin/products', label: 'Products', icon: Package, hint: 'List and maintain the product catalogue' },
    ] },
  ],
  merchant: [
    { title: 'My shop', actions: [
      { to: '/shop-setup', label: 'Shop setup', icon: Store, hint: 'Update your public shop page' },
      { to: '/inventory', label: 'Inventory', icon: Boxes, hint: 'Add products, manage stock and sync drafts' },
      { to: '/orders', label: 'Orders', icon: Truck, hint: 'Review items, pack orders and track delivery' },
    ] },
  ],
  delivery: [
    { title: 'Delivery', actions: [
      { to: '/rider', label: 'My deliveries', icon: Bike, hint: 'Accept jobs and update delivery progress' },
    ] },
  ],
};

const MERCHANT_CARD_LINKS = {
  myProducts: '/inventory',
  liveMine: '/inventory',
  pendingMine: '/inventory',
  myOrders: '/orders',
  activeOrders: '/orders',
  revenue: '/orders',
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
  const Icon = roleIcon[user.role] || Store;
  const description = user.role === 'merchant'
    ? `Welcome back, ${user.name.split(' ')[0]}.${user.shopName ? ` ${user.shopName} is ready for business.` : ' Keep your shop and orders moving.'}`
    : user.role === 'delivery'
      ? `Welcome back, ${user.name.split(' ')[0]}. Your jobs and earnings update as deliveries move.`
      : `Welcome back, ${user.name}. You see everything the moment it happens.`;

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        icon={Icon}
        eyebrow={user.role === 'merchant' ? 'Merchant workspace' : user.role === 'delivery' ? 'Rider workspace' : 'Operations workspace'}
        title={roleTitle[user.role] || 'Dashboard'}
        description={description}
        status={<span className="workspace-live">{live} Live updates</span>}
      />

      <div className="stat-grid">
        {data.cards.map((c) => {
          const card = (
            <>
              <div className="stat-value">{fmt(c.value)}</div>
              <div className="stat-label">{c.label}</div>
              {user.role === 'merchant' && <span className="workspace-stat-link">View <ChevronRight size={13} aria-hidden="true" /></span>}
            </>
          );
          return user.role === 'merchant' && MERCHANT_CARD_LINKS[c.key]
            ? <Link key={c.key} to={MERCHANT_CARD_LINKS[c.key]} className={`stat-card workspace-stat-card${c.accent ? ' accent' : ''}`}>{card}</Link>
            : <div key={c.key} className={`stat-card${c.accent ? ' accent' : ''}`}>{card}</div>;
        })}
      </div>

      <div className="dash-cols workspace-dashboard-grid">
        <details className="workspace-panel workspace-dashboard-panel" open>
          <summary className="workspace-panel-summary"><h2>Quick actions</h2><ChevronDown size={17} aria-hidden="true" /></summary>
          {roleActions[user.role]?.map((section) => (
            <section key={section.title} className="dash-action-section">
              <h3>{section.title}</h3>
              {section.actions.map((a) => (
                <Link key={a.label} to={a.to} className="action-row">
                  <strong><a.icon size={17} className="action-icon" aria-hidden="true" />{a.label}</strong>
                  <span className="muted">{a.hint}</span>
                </Link>
              ))}
            </section>
          ))}
        </details>
        <details className="workspace-panel workspace-dashboard-panel" open>
          <summary className="workspace-panel-summary"><h2>Recent orders</h2><ChevronDown size={17} aria-hidden="true" /></summary>
          {data.recentOrders.length === 0 && <p className="empty">Nothing yet.</p>}
          {/* Compact minimal history — collapsed order cards; tap one to open
              its items, bill and delivery details in place. */}
          <div className="order-list">
            {data.recentOrders.map((o) => (
              <OrderCard key={o._id} order={o} viewer={user.role} compact showOtp={user.role === 'customer'} />
            ))}
          </div>
          {user.role === 'merchant' && data.recentOrders.length > 0 && (
            <Link to="/orders" className="dash-see-all muted">
              View and fulfil orders <ChevronRight size={13} aria-hidden="true" />
            </Link>
          )}
        </details>
      </div>
    </div>
  );
}
