import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CircleCheck, Ban, ChevronDown, UserCircle2 } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import { useToast } from '@shared/context/ToastContext';

const statusIcon = { pending: <Clock size={14} color="var(--warning-accent)" />, approved: <CircleCheck size={14} color="var(--success)" />, suspended: <Ban size={14} color="var(--danger-strong)" /> };
const partnerLabel = { pending: 'Pending', approved: 'Approved', suspended: 'Suspended' };

/** Every field the admin's filled profile panel can show for a merchant. */
function MerchantDetails({ m }) {
  return (
    <dl className="detail-grid">
      <div><dt>Shop name</dt><dd>{m.shopName || 'Not set yet'}</dd></div>
      <div><dt>Owner</dt><dd>{m.name || '—'}</dd></div>
      <div><dt>Email</dt><dd>{m.email}</dd></div>
      <div><dt>Phone</dt><dd>{m.phone || 'Not set'}</dd></div>
      <div><dt>Shop contact</dt><dd>{m.shopPhone || 'Not set'}</dd></div>
      <div><dt>Status</dt><dd>{partnerLabel[m.merchantStatus] || m.merchantStatus}</dd></div>
      <div><dt>Joined</dt><dd>{new Date(m.createdAt).toLocaleDateString('en-IN')}</dd></div>
      <div className="detail-wide"><dt>Shop address</dt>
        <dd>{[m.shopAddress?.line, m.shopAddress?.ward && `Ward ${m.shopAddress.ward}`, 'Birgunj'].filter(Boolean).join(', ') || 'Not set yet'}</dd>
      </div>
      {m.shopDescription && <div className="detail-wide"><dt>Description</dt><dd>{m.shopDescription}</dd></div>}
    </dl>
  );
}

/** Every field the admin's filled profile panel can show for a rider. */
function RiderDetails({ r }) {
  return (
    <dl className="detail-grid">
      <div><dt>Name</dt><dd>{r.name}</dd></div>
      <div><dt>Email</dt><dd>{r.email}</dd></div>
      <div><dt>Phone</dt><dd>{r.phone || 'Not set'}</dd></div>
      <div><dt>Vehicle</dt><dd>{r.riderVehicle || 'Not set'}</dd></div>
      <div><dt>Area</dt><dd>{r.riderArea || 'Not set'}</dd></div>
      <div><dt>Status</dt><dd>{RIDER_LABEL[r.riderStatus] || r.riderStatus}</dd></div>
      <div><dt>Joined</dt><dd>{new Date(r.createdAt).toLocaleDateString('en-IN')}</dd></div>
    </dl>
  );
}

const RIDER_LABEL = { pending: 'Pending', available: 'Available', on_delivery: 'On delivery', offline: 'Offline', suspended: 'Suspended' };

/** Expandable profile panel — collapsed by default, opens inline in place. */
function ExpandableRow({ id, icon: Icon, title, subtitle, right, open, onToggle, children }) {
  const rowId = `detail-${id}`;
  return (
    <div className={`profile-row${open ? ' open' : ''}`}>
      <button type="button" className="profile-row-head" aria-expanded={open} aria-controls={rowId} onClick={onToggle}>
        <Icon size={17} aria-hidden="true" />
        <span className="profile-row-title"><strong>{title}</strong><small>{subtitle}</small></span>
        <span className="profile-row-side">{right}<ChevronDown size={16} className={`profile-row-chevron${open ? ' is-open' : ''}`} aria-hidden="true" /></span>
      </button>
      {open && <div id={rowId} className="profile-row-body">{children}</div>}
    </div>
  );
}

export default function AdminPartners() {
  const { user } = useAuth();
  const toast = useToast();
  const [partners, setPartners] = useState([]);
  const [pending, setPending] = useState([]);
  const [riders, setRiders] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  // one open panel at a time — tapping a merchant or a rider opens their filled details
  const [openId, setOpenId] = useState(null);

  const load = async () => {
    setError('');
    const results = await Promise.allSettled([
      API.get('/admin/partners'),
      API.get('/admin/partners/pending-products'),
      API.get('/delivery/riders'),
    ]);
    if (results[0].status === 'fulfilled') setPartners(results[0].value.data);
    if (results[1].status === 'fulfilled') setPending(results[1].value.data);
    if (results[2].status === 'fulfilled') setRiders(results[2].value.data);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) setError(failed.reason?.response?.data?.message || 'Some approval lists could not be loaded. Refresh to try again.');
  };
  // live updates: new submissions / applications appear automatically
  useLive(load, 6000, [user?._id]);

  const act = async (key, request, onDone) => {
    setBusy(key); setError('');
    try { await request(); await load(); if (onDone) onDone(); }
    catch (e) {
      setError(e.response?.data?.message || 'That action could not be completed.');
      toast.error('That action could not be completed');
    }
    finally { setBusy(''); }
  };
  const setPartnerStatus = (id, status, name) => act(id, () => API.patch(`/admin/partners/${id}/status`, { status }),
    () => toast.success(status === 'approved' ? `${name || 'Partner'} approved` : status === 'suspended' ? 'Partner suspended' : 'Partner re-pended'));
  const approveRider = (id, name) => act(id, () => API.patch(`/admin/delivery/riders/${id}/status`, { status: 'available' }),
    () => toast.success(`${name || 'Rider'} approved`));
  const review = (id, status, name) => act(id, () => API.patch(`/admin/partners/products/${id}/review`, { status }),
    () => toast.success(status === 'approved' ? `“${name || 'Product'}” approved and live` : `“${name || 'Product'}” rejected`));

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> as admin.</p>;
  if (user.role !== 'admin') return <p className="empty">Admin access only.</p>;

  const pendingPartners = partners.filter((m) => m.merchantStatus === 'pending');
  const listedPartners = partners.filter((m) => m.merchantStatus !== 'pending');
  const pendingRiders = riders.filter((r) => r.riderStatus === 'pending');

  return (
    <div>
      <h1>Approvals</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="section">
        <h2>Product submissions ({pending.length})</h2>
        <p className="muted">Review partner listings before they appear in the storefront.</p>
      {pending.length === 0 && <p className="empty">Nothing waiting for review.</p>}
      {pending.map((p) => (
        <div key={p._id} className="order-card">
          <div className="order-head">
            <strong>{p.name}</strong>
            <span>{p.category} · NPR ₹ {p.price}/{p.unit} · stock {p.stock}</span>
            <span className="muted">by {p.merchant?.shopName || p.merchant?.name || 'unknown'}</span>
          </div>
          <p>{p.description}</p>
          <div className="order-head" style={{ marginTop: '.5rem' }}>
            <button disabled={busy === p._id} onClick={() => review(p._id, 'approved', p.name)}>Approve</button>
            <button className="danger" disabled={busy === p._id} onClick={() => review(p._id, 'rejected', p.name)}>Reject</button>
          </div>
        </div>
      ))}
      </section>

      <section className="section">
      <h2>Partner applications ({pendingPartners.length})</h2>
      {pendingPartners.length === 0 ? <p className="empty">No partner applications waiting.</p> : (
        <div className="profile-rows">
          {pendingPartners.map((m) => (
            <ExpandableRow key={m._id} id={m._id} icon={UserCircle2} title={m.shopName || 'Shop not set up'}
              subtitle={`${m.name} · ${m.email}${m.phone ? ` · ${m.phone}` : ''}`}
              right={<span className={`status s-${m.merchantStatus}`}>{partnerLabel[m.merchantStatus]}</span>}
              open={openId === m._id} onToggle={() => setOpenId(openId === m._id ? null : m._id)}>
              <MerchantDetails m={m} />
              <div className="profile-row-actions">
                <button disabled={busy === m._id} onClick={() => setPartnerStatus(m._id, 'approved', m.shopName || m.name)}>Approve</button>
              </div>
            </ExpandableRow>
          ))}
        </div>
      )}
      </section>

      <section className="section">
        <h2>Rider applications ({pendingRiders.length})</h2>
        {pendingRiders.length === 0 ? <p className="empty">No rider applications waiting.</p> : (
          <div className="profile-rows">
            {pendingRiders.map((r) => (
              <ExpandableRow key={r._id} id={r._id} icon={UserCircle2} title={r.name}
                subtitle={`${r.riderVehicle || 'rider'} · ${r.email}${r.phone ? ` · ${r.phone}` : ''}`}
                right={<span className="status s-pending">Pending</span>}
                open={openId === r._id} onToggle={() => setOpenId(openId === r._id ? null : r._id)}>
                <RiderDetails r={r} />
                <div className="profile-row-actions">
                  <button disabled={busy === r._id} onClick={() => approveRider(r._id, r.name)}>Approve</button>
                </div>
              </ExpandableRow>
            ))}
          </div>
        )}
      </section>

      <section className="section">
      <h2>Partner directory ({partners.length})</h2>
      {listedPartners.length === 0 ? <p className="empty">No partners listed yet.</p> : (
        <div className="profile-rows">
          {listedPartners.map((m) => (
            <ExpandableRow key={m._id} id={m._id} icon={UserCircle2} title={m.shopName || 'Shop not set up'}
              subtitle={`${m.name} · ${m.email}${m.phone ? ` · ${m.phone}` : ''}`}
              right={<span className={`status s-${m.merchantStatus}`}>{statusIcon[m.merchantStatus]} {partnerLabel[m.merchantStatus]}</span>}
              open={openId === m._id} onToggle={() => setOpenId(openId === m._id ? null : m._id)}>
              <MerchantDetails m={m} />
              <div className="profile-row-actions">
                {m.merchantStatus === 'approved' && <button className="danger" disabled={busy === m._id} onClick={() => setPartnerStatus(m._id, 'suspended', m.shopName || m.name)}>Suspend</button>}
                {m.merchantStatus === 'suspended' && <button disabled={busy === m._id} onClick={() => setPartnerStatus(m._id, 'pending', m.shopName || m.name)}>Re-pend</button>}
              </div>
            </ExpandableRow>
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
