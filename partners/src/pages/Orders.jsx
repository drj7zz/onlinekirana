import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, Bike, Phone, Store, PackageCheck, Search } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';
import { productPath } from '@shared/lib/productUrl';
import { STOREFRONT_URL } from '@shared/lib/apps';
import { imageUrl } from '@shared/api';

/**
 * What the shop is being asked to do right now. The merchant's whole job is to
 * pack the goods; riders choose open jobs from their dashboard. This strip
 * shows whether a rider has accepted the job and is on the way to the
 * counter, so nobody has to phone to ask.
 */
const STAGE = {
  pending: {
    label: 'Waiting to be packed',
    hint: 'Pack the goods, then mark it packed — riders can choose to accept it.',
  },
  confirmed: {
    label: 'Waiting to be packed',
    hint: 'Pack the goods, then mark it packed — riders can choose to accept it.',
  },
  packed: {
    label: 'Packed — waiting for a rider',
    hint: 'You are done here. The job is open for riders to accept.',
  },
  assigned: {
    label: 'Rider accepted the delivery',
    hint: 'A rider chose the job and is heading to your counter. Keep the goods ready.',
  },
  out_for_delivery: {
    label: 'Rider has collected the goods',
    hint: 'The rider has your order and is on the way to the customer.',
  },
  delivered: { label: 'Delivered', hint: 'This order is complete.' },
  cancelled: { label: 'Cancelled', hint: 'This order was cancelled.' },
};

/** The rider panel — only once a rider is actually on the job. */
function RiderPanel({ delivery, orderStatus }) {
  if (!delivery) return null;
  const rider = delivery.rider;
  if (!rider) {
    return (
      <p className="order-note" style={{ marginBottom: '.6rem' }}>
        <Bike size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
        <strong>{orderStatus === 'packed' ? 'No rider yet.' : 'Waiting for the shop.'}</strong> {orderStatus === 'packed' ? 'The job is open — an on-shift rider can accept it.' : 'Riders can choose the job after you mark it packed.'}
      </p>
    );
  }
  return (
    <div className="order-note" style={{ marginBottom: '.6rem' }}>
      <Bike size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
      <strong>{rider.name}</strong>
      {rider.riderVehicle && <span className="muted"> · {rider.riderVehicle}</span>}
      {rider.phone && (
        <>
          {' · '}
          <a className="job-phone" href={`tel:${rider.phone}`}>
            <Phone size={12} aria-hidden="true" /> {rider.phone}
          </a>
        </>
      )}
      <div className="muted" style={{ marginTop: '.2rem' }}>
        {delivery.status === 'assigned' && 'Heading to your counter — hand the goods over when they arrive.'}
        {delivery.status === 'accepted' && 'At your counter now.'}
        {delivery.status === 'picked' && 'Goods collected. The customer is tracking the drop.'}
        {delivery.status === 'delivered' && 'Delivered to the customer.'}
      </div>
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  const load = () => {
    API.get('/partner/orders')
      .then((r) => setOrders(r.data))
      .catch(() => setError('We could not load your orders right now.'));
  };
  useLive(load, 8000, [user?._id]);

  // Packing makes the delivery available for riders to accept.
  const pack = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await API.patch(`/partner/orders/${id}/status`, { status: 'packed' });
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not mark that order packed.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to see your orders.</p>;
  if (user.role !== 'merchant') return <p className="empty">Order fulfilment is for merchant partners only.</p>;

  const inDelivery = ['packed', 'assigned', 'out_for_delivery', 'delivered', 'cancelled'];
  const toPack = orders.filter((o) => !inDelivery.includes(o.status));
  const history = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((o) => historyFilter === 'all' || (historyFilter === 'active' ? !['delivered', 'cancelled'].includes(o.status) : o.status === historyFilter))
    .filter((o) => !historySearch.trim() || `${o._id} ${o.status} ${(o.items || []).map((i) => i.name).join(' ')}`.toLowerCase().includes(historySearch.trim().toLowerCase()));

  return (
    <div>
      <h1>Orders</h1>
      <p className="muted">
        Pack the goods and mark each order packed. Riders see the open job and choose
        whether to accept it; area alone never assigns an order to someone.
      </p>

      {error && <p className="error">{error}</p>}

      {orders.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={32} aria-hidden="true" />
          <p>No orders with your items yet. When customers buy from your shop, their orders appear here with a delivery tracker.</p>
        </div>
      ) : (
        <>
          <h2>To pack ({toPack.length})</h2>
          {toPack.length === 0 ? (
            <p className="empty">Nothing waiting — every order is with the delivery system.</p>
          ) : (
            <div className="order-list">
              {toPack.map((o) => (
                <article key={o._id} className="order-card">
                  <header className="order-head">
                    <div className="order-head-main">
                      <span className="order-ref">Order #{String(o._id).slice(-6).toUpperCase()}</span>
                      <span className="muted">{(o.items || []).filter((i) => i.merchant === user._id).length} of your item(s)</span>
                    </div>
                    <div className="order-head-side">
                      <strong className="order-total">रू {Number(o.total || 0).toLocaleString('en-IN')}</strong>
                      <button className="cta-btn" onClick={() => pack(o._id)} disabled={busyId === o._id}>
                        <PackageCheck size={15} aria-hidden="true" />
                        {busyId === o._id ? 'Packing…' : 'Mark packed'}
                      </button>
                    </div>
                  </header>

                  <div className="order-note">
                    <Store size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
                    <strong>{STAGE[o.status]?.label || o.status}</strong>
                    <div className="muted" style={{ marginTop: '.2rem' }}>{STAGE[o.status]?.hint}</div>
                  </div>

                  <div className="order-items">
                    <ul>
                      {(o.items || [])
                        .filter((i) => i.merchant === user._id)
                        .map((i, idx) => {
                          const product = i.product && typeof i.product === 'object' ? i.product : null;
                          const productId = product?._id || i.product;
                          const photo = imageUrl(product?.imageUrl);
                          return (
                            <li key={idx}>
                              <span className="oi-name">
                                {productId ? (
                                  <details className="partner-order-product">
                                    <summary className="oi-link">{i.name}</summary>
                                    <div className="partner-order-product-info">
                                      {photo && <img src={photo} alt={i.name} loading="lazy" />}
                                      <div>
                                        {product?.category && <strong>{product.category}</strong>}
                                        <p>{product?.description || 'No product description available.'}</p>
                                        <a href={`${STOREFRONT_URL}${productPath({ _id: productId, name: i.name })}`} target="_blank" rel="noreferrer">
                                          View product
                                        </a>
                                      </div>
                                    </div>
                                  </details>
                                ) : i.name}
                              </span>
                              <span className="oi-qty">{i.qty} {i.unit}</span>
                              <span className="oi-price">रू {Number(i.price || 0).toLocaleString('en-IN')}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>

                  {o.deliveryInstructions && (
                    <p className="order-note"><strong>Customer note:</strong> {o.deliveryInstructions}</p>
                  )}
                </article>
              ))}
            </div>
          )}

          <h2>With the delivery system ({orders.length - toPack.length})</h2>
          {orders.length - toPack.length === 0 ? (
            <p className="empty">Nothing on the road yet.</p>
          ) : (
            <div className="order-list">
              {orders
                .filter((o) => inDelivery.includes(o.status))
                .map((o) => (
                  <article key={o._id} className="order-card">
                    <header className="order-head">
                      <div className="order-head-main">
                        <span className="order-ref">Order #{String(o._id).slice(-6).toUpperCase()}</span>
                        <span className={`status s-${o.status}`}>{STAGE[o.status]?.label || o.status}</span>
                      </div>
                      <div className="order-head-side">
                        <strong className="order-total">रू {Number(o.total || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    </header>

                    <p className="muted" style={{ margin: '0 0 .5rem' }}>{STAGE[o.status]?.hint}</p>

                    <RiderPanel delivery={o.delivery} orderStatus={o.status} />
                  </article>
                ))}
            </div>
          )}

          <h2>Full history</h2>
          <section className="history-tools" aria-label="Filter order history">
            <label className="history-search"><Search size={16} aria-hidden="true" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search orders or products" aria-label="Search order history" /></label>
            <div className="history-filters" role="group" aria-label="Order status">
              {[['all', 'All orders'], ['active', 'In progress'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']].map(([key, label]) => <button key={key} type="button" className={historyFilter === key ? 'active' : ''} aria-pressed={historyFilter === key} onClick={() => setHistoryFilter(key)}>{label}</button>)}
            </div>
          </section>
          <div className="order-list">
            {history.map((o) => (
              <OrderCard key={o._id} order={o} viewer="merchant" compact />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
