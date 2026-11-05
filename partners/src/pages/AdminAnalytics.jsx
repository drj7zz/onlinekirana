import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, TrendingUp, Users, Clock, PackageSearch, Star } from 'lucide-react';
import API from '@shared/api';
import useSeo from '@shared/hooks/useSeo';
import WorkspaceHeader from '../components/WorkspaceHeader.jsx';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : '—');
const minutes = (m) => (m == null ? '—' : m < 90 ? `${m} min` : `${(m / 60).toFixed(1)} hr`);

/** One compact metric tile. */
function Tile({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={`stat-card${accent ? ' accent' : ''}`}>
      <Icon size={17} aria-hidden="true" />
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <p className="muted" style={{ fontSize: '.72rem' }}>{sub}</p>}
    </div>
  );
}

/** A small tabular data block, the admin's preferred way to read numbers. */
function MiniTable({ head, rows }) {
  return (
    <div className="audit-table-wrap">
      <table className="table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
             
            <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The analytics page for the operations desk. Everything comes from the server
 * over real order data — no client-side math on partial lists.
 */
export default function AdminAnalytics() {
  useSeo({ title: 'Analytics — OnlineKirana Partners', noindex: true });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    API.get('/admin/analytics')
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(e.response?.data?.message || 'Analytics could not be loaded.'));
  }, []);

  if (error) {
    return (
      <div className="workspace-page">
        <WorkspaceHeader icon={Activity} eyebrow="Operations workspace" title="Analytics" />
        <p className="error" role="alert">{error}</p>
      </div>
    );
  }
  if (!data) return <p className="loading-shimmer">Crunching the numbers</p>;

  const d = data;
  return (
    <div className="workspace-page">
      <WorkspaceHeader
        icon={Activity}
        eyebrow="Operations workspace"
        title="Analytics"
        description={`The last ${d.window} across orders, customers, stock and reviews — computed from live data.`}
      />

      <section className="workspace-panel">
        <div className="workspace-section-heading"><div><h2>Customers</h2><p>Repeat behaviour and order frequency</p></div></div>
        <div className="stat-grid">
          <Tile icon={Users} label="Repeat rate" value={`${d.customers.repeatRate}%`} sub="share of customers with 2+ orders" accent />
          <Tile icon={TrendingUp} label="Avg orders / customer" value={d.customers.averageOrdersPerCustomer} />
          <Tile icon={Users} label="Customers" value={fmt(d.customers.total)} />
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-section-heading"><div><h2>Orders &amp; delays</h2><p>Fulfilment health</p></div></div>
        <div className="stat-grid">
          <Tile icon={Clock} label="Avg delay" value={minutes(d.delay.avgMinutes)} sub="placed → delivered" accent />
          <Tile icon={Clock} label="Slowest 10%" value={minutes(d.delay.p90Minutes)} />
          <Tile icon={TrendingUp} label="Fulfilment rate" value={`${d.orders.fulfilmentRate}%`} />
          <Tile icon={TrendingUp} label="Cancel rate" value={`${d.orders.cancelRate}%`} />
        </div>
        <MiniTable
          head={['Status', 'Orders (30d)']}
          rows={Object.entries(d.orders.byStatus).map(([k, v]) => [k.replace(/_/g, ' '), fmt(v)])}
        />
      </section>

      <section className="workspace-panel">
        <div className="workspace-section-heading"><div><h2>Revenue</h2><p>Cash across the marketplace</p></div></div>
        <div className="stat-grid">
          <Tile icon={TrendingUp} label="Revenue (30d)" value={`रू ${fmt(d.revenue.total)}`} accent />
          <Tile icon={TrendingUp} label="Avg order value" value={`रू ${fmt(d.revenue.averageOrder)}`} />
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-section-heading"><div><h2>Stock &amp; catalogue</h2><p>Refill pressure at a glance</p></div></div>
        <div className="stat-grid">
          <Tile icon={PackageSearch} label="Low stock (≤5)" value={fmt(d.stock.lowStock)} accent />
          <Tile icon={PackageSearch} label="Out of stock" value={fmt(d.stock.outOfStock)} accent />
          <Tile icon={PackageSearch} label="Awaiting approval" value={fmt(d.stock.pendingApproval)} />
          <Tile icon={PackageSearch} label="Total products" value={fmt(d.stock.products)} />
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-section-heading"><div><h2>Reviews &amp; partners</h2><p>What customers are saying</p></div></div>
        <div className="stat-grid">
          <Tile icon={Star} label="Avg rating" value={d.reviews.average || '—'} sub={`${fmt(d.reviews.count)} reviews in 30d`} />
          <Tile icon={Users} label="Live shops" value={fmt(d.partners.approvedMerchants)} />
          <Tile icon={Users} label="Riders" value={fmt(d.partners.riders)} />
        </div>
      </section>

      {d.topProducts.length > 0 && (
        <section className="workspace-panel">
          <div className="workspace-section-heading"><div><h2>Top sellers</h2><p>By units sold in the window</p></div></div>
          <MiniTable head={['Product', 'Units']} rows={d.topProducts.map((t) => [t.name || '—', fmt(t.qty)])} />
        </section>
      )}

      <p className="muted"><Link to="/admin/orders">Back to orders</Link></p>
    </div>
  );
}
