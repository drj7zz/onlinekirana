import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, Bike, Phone, Store, PackageCheck, Search, ReceiptText, CircleCheck, SlidersHorizontal } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import OrderCard from '@shared/components/OrderCard';
import Dropdown from '@shared/components/Dropdown';
import { productPath } from '@shared/lib/productUrl';
import { STOREFRONT_URL } from '@shared/lib/apps';
import { imageUrl } from '@shared/api';
import WorkspaceHeader from '../components/WorkspaceHeader.jsx';

/**
 * The shop accepts the order and packs it; riders choose packed delivery jobs.
 */
const STAGE = {
  pending: {
    label: 'New order',
    hint: 'Review the customer and basket, then accept the order.',
  },
  confirmed: {
    label: 'Accepted — ready to pack',
    hint: 'Prepare the products, then mark the order packed for riders.',
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

  const setStatus = async (id, status) => {
    setBusyId(id);
    setError('');
    try {
      await API.patch(`/partner/orders/${id}/status`, { status });
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Could not update this order. Please refresh and try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to see your orders.</p>;
  if (user.role !== 'merchant') return <p className="empty">Order fulfilment is for merchant partners only.</p>;

  const inDelivery = ['packed', 'assigned', 'out_for_delivery', 'delivered', 'cancelled'];
  const toPack = orders.filter((o) => ['pending', 'confirmed'].includes(o.status));
  const deliveryOrders = orders.filter((o) => inDelivery.includes(o.status));
  const history = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((o) => historyFilter === 'all' || (historyFilter === 'active' ? !['delivered', 'cancelled'].includes(o.status) : o.status === historyFilter))
    .filter((o) => !historySearch.trim() || `${o._id} ${o.status} ${(o.items || []).map((i) => i.name).join(' ')}`.toLowerCase().includes(historySearch.trim().toLowerCase()));

  return (
    <div className="workspace-page">
      <WorkspaceHeader
        icon={ReceiptText}
        eyebrow="Merchant workspace"
        title="Shop orders"
        description="Pack orders and hand them over to a rider. Riders choose open jobs when they are ready."
      />

      {error && <p className="error">{error}</p>}

      {orders.length === 0 ? (
        <div className="empty-state workspace-panel">
          <PackageOpen size={32} aria-hidden="true" />
          <p>No orders with your items yet. When customers buy from your shop, their orders appear here with a delivery tracker.</p>
        </div>
      ) : (
        <>
          <div className="workspace-section-heading">
            <div><h2>New &amp; preparing</h2><p>Review each order, accept it, then pack the products.</p></div>
            <span className="workspace-count">{toPack.length}</span>
          </div>
          {toPack.length === 0 ? (
            <p className="empty">No orders are waiting for acceptance or packing.</p>
          ) : (
            <div className="order-list">
              {toPack.map((o) => (
                <article key={o._id} className="order-card order-workflow-card">
                  <header className="order-head">
                    <div className="order-head-main">
                      <span className="order-ref">Order #{String(o._id).slice(-6).toUpperCase()}</span>
                      <span className="muted">{(o.items || []).filter((i) => i.merchant === user._id).length} of your item(s)</span>
                      <span className={`status s-${o.status}`}>{STAGE[o.status]?.label || o.status}</span>
                    </div>
                    <div className="order-head-side">
                      <strong className="order-total">रू {Number(o.total || 0).toLocaleString('en-IN')}</strong>
                      {o.status === 'pending' ? (
                        <button className="cta-btn" onClick={() => setStatus(o._id, 'confirmed')} disabled={busyId === o._id}>
                          <CircleCheck size={15} aria-hidden="true" /> {busyId === o._id ? 'Accepting…' : 'Accept order'}
                        </button>
                      ) : (
                        <button className="cta-btn" onClick={() => setStatus(o._id, 'packed')} disabled={busyId === o._id}>
                          <PackageCheck size={15} aria-hidden="true" /> {busyId === o._id ? 'Packing…' : 'Mark packed'}
                        </button>
                      )}
                    </div>
                  </header>

                  <div className="order-note">
                    <Store size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
                    <strong>{STAGE[o.status]?.label || o.status}</strong>
                    <div className="muted" style={{ marginTop: '.2rem' }}>{STAGE[o.status]?.hint}</div>
                  </div>

                  <details className="workspace-disclosure order-details-disclosure" open>
                    <summary><span>Customer &amp; order details</span><small>{(o.items || []).filter((i) => i.merchant === user._id).length} item(s)</small></summary>
                    <div className="workspace-disclosure-body">
                      <div className="order-customer-details">
                        <div><span>Customer</span><strong>{o.user?.name || 'Customer'}</strong></div>
                        <div><span>Delivery address</span><strong>{[o.deliveryAddress?.line, o.deliveryAddress?.ward && `Ward ${o.deliveryAddress.ward}`, 'Birgunj'].filter(Boolean).join(', ') || 'Address unavailable'}</strong></div>
                        <div><span>Contact</span>{o.deliveryAddress?.phone ? <a href={`tel:${o.deliveryAddress.phone}`}>{o.deliveryAddress.phone}</a> : <strong>Not provided</strong>}</div>
                        <div><span>Payment</span><strong>{o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod}</strong></div>
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
                                        <a href={`${STOREFRONT_URL()}${productPath({ _id: productId, name: i.name })}`} target="_blank" rel="noreferrer">
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
                      {o.deliveryInstructions && <p className="order-note"><strong>Delivery note:</strong> {o.deliveryInstructions}</p>}
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}

          <div className="workspace-section-heading">
            <div><h2>With the delivery system</h2><p>Track orders that have left your packing queue.</p></div>
            <span className="workspace-count">{deliveryOrders.length}</span>
          </div>
          {deliveryOrders.length === 0 ? (
            <p className="empty">Nothing on the road yet.</p>
          ) : (
            <div className="order-list">
              {deliveryOrders.map((o) => (
                <article key={o._id} className="order-card order-workflow-card">
                  <details className="workspace-disclosure delivery-track-details">
                    <summary>
                      <span>
                        Order #{String(o._id).slice(-6).toUpperCase()}
                        <span className={`status s-${o.status}`}>{STAGE[o.status]?.label || o.status}</span>
                      </span>
                      <small>रू {Number(o.total || 0).toLocaleString('en-IN')}</small>
                    </summary>
                    <div className="workspace-disclosure-body">
                      <p className="muted" style={{ margin: '.65rem 0' }}>{STAGE[o.status]?.hint}</p>
                      <RiderPanel delivery={o.delivery} orderStatus={o.status} />
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}

          <div className="workspace-section-heading">
            <div><h2>Order history</h2><p>Search and filter your shop&apos;s past orders.</p></div>
            <span className="workspace-count">{history.length}</span>
          </div>
          <section className="history-tools" aria-label="Filter order history">
            <Dropdown
              icon={SlidersHorizontal}
              value={historyFilter}
              options={[
                ['all', 'All orders'],
                ['active', 'In progress'],
                ['delivered', 'Delivered'],
                ['cancelled', 'Cancelled'],
              ].map(([v, l]) => ({ value: v, label: l }))}
              onChange={setHistoryFilter}
            />
            <label className="history-search"><Search size={16} aria-hidden="true" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search orders or products" aria-label="Search order history" /></label>
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
