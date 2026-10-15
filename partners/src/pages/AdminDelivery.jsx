import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike, PackageOpen, UserPlus, Phone, MapPin, KeyRound, Store, Ban, Power,
} from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import {
  DELIVERY_LABEL, DELIVERY_WINDOW_LABEL, RIDER_STATUS_LABEL, RIDER_STATUS_TONE, money, timeAgo,
} from '@shared/lib/delivery';
import { productPath } from '@shared/lib/productUrl';
import { STOREFRONT_URL } from '@shared/lib/apps';

const emptyRider = { name: '', email: '', phone: '', riderArea: '', riderVehicle: '' };

/** One dispatch row: monitor progress or cancel a delivery. */
function JobRow({ job, onAdvance, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const job$ = job.order || {};
  const drop = job.dropoff || {};

  const closed = ['delivered', 'failed'].includes(job.status);

  const guard = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(e.response?.data?.message || 'That did not work.'); } finally { setBusy(false); }
  };

  return (
    <article className="order-card job-card">
      <header className="order-head">
        <div className="order-head-main">
          <span className={`status s-${job.status}`}>
            {job$.status === 'packed' || ['assigned', 'out_for_delivery'].includes(job$.status)
              ? DELIVERY_LABEL[job.status]
              : 'Waiting for shop to pack'}
          </span>
          <span className="muted">#{String(job._id).slice(-6).toUpperCase()} · {timeAgo(job.createdAt)}</span>
        </div>
        <div className="order-head-side">
          <strong className="order-total">{Number(job.fee || 0) === 0 ? 'Free delivery' : money(job.fee)}</strong>
        </div>
      </header>

      <div className="job-route">
        <div className="job-leg">
          <span className="job-leg-icon"><Store size={15} aria-hidden="true" /></span>
          <div>
            <span className="job-leg-label">Collect from</span>
            <strong>{job.pickup?.shopName || 'OnlineKirana counter'}</strong>
          </div>
        </div>
        <div className="job-leg">
          <span className="job-leg-icon drop"><MapPin size={15} aria-hidden="true" /></span>
          <div>
            <span className="job-leg-label">Deliver to</span>
            <strong>{drop.name || 'Customer'}</strong>
            <span className="muted">{[drop.line, drop.ward && `Ward ${drop.ward}`].filter(Boolean).join(', ')}, Birgunj</span>
            {drop.phone && <a className="job-phone" href={`tel:${drop.phone}`}><Phone size={12} aria-hidden="true" /> {drop.phone}</a>}
          </div>
        </div>
      </div>

      <details className="admin-delivery-items">
        <summary>{job$?.items?.length || 0} item(s) · basket {money(job$?.total || 0)} · View order items</summary>
        <ul>
          {(job$?.items || []).map((item, index) => (
            <li key={`${item.product || item.name}-${index}`}>
              {item.product ? (
                <a href={`${STOREFRONT_URL}${productPath({ _id: item.product, name: item.name })}`} target="_blank" rel="noreferrer">{item.name}</a>
              ) : item.name}
              <span>× {item.qty} {item.unit}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="muted job-order">
        {job?.slot && <>Delivery window: <strong>{DELIVERY_WINDOW_LABEL[job.slot] || job.slot}</strong></>}
        {!job.rider && (job$.status === 'packed' ? 'Waiting for an on-shift rider to accept.' : 'Waiting for the shop to pack this order.')}
      </p>

      {!closed && (
        <div className="job-actions admin">
          {job.rider && (
            <span className="muted">
              <Bike size={14} aria-hidden="true" /> Rider: <strong>{job.rider.name}</strong>
              {job.rider.phone && <> · {job.rider.phone}</>}
            </span>
          )}

          {job.status === 'picked' && (
            <label className="inline-label">
              <KeyRound size={13} aria-hidden="true" /> Customer code
              <input maxLength={4} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="····" />
            </label>
          )}

          {job.status === 'picked' && (
            <button className="cta-btn" disabled={busy || otp.length !== 4}
              onClick={() => guard(() => onAdvance(job._id, 'delivered', otp))}>
              Mark delivered
            </button>
          )}

          <button className="danger" disabled={busy}
            onClick={() => {
              const reason = prompt('Why is this being cancelled?');
              if (reason) guard(() => onCancel(job._id, reason));
            }}>
            Cancel order
          </button>
        </div>
      )}

      {job.attemptNote && <p className="order-note cancel"><strong>Note:</strong> {job.attemptNote}</p>}
      {err && <p className="error">{err}</p>}
    </article>
  );
}

export default function AdminDelivery() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [riders, setRiders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyRider);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    API.get('/delivery/orders').then(({ data }) => setJobs(data)).catch(() => setError('Could not load the dispatch board.'));
    API.get('/delivery/riders').then(({ data }) => setRiders(data)).catch(() => { });
    API.get('/admin/delivery/summary').then(({ data }) => setSummary(data)).catch(() => { });
  };
  useLive(load, 6000, [user?._id]);

  const guard = async (fn) => {
    setError('');
    try { await fn(); load(); } catch (e) { setError(e.response?.data?.message || 'That did not work.'); }
  };

  const addRider = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setCreated(null);
    try {
      const { data } = await API.post('/admin/delivery/riders', form);
      setCreated(data);
      setForm(emptyRider);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add that rider.');
    } finally { setBusy(false); }
  };

  const setRiderStatus = (id, status) => guard(() => API.patch(`/admin/delivery/riders/${id}/status`, { status }));

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to manage delivery.</p>;
  if (user.role !== 'admin') return <p className="empty">Admin access only.</p>;

  const waiting = jobs.filter((j) => !j.rider && j.status === 'pending' && j.order?.status === 'packed');
  const rest = jobs.filter((j) => !(!j.rider && j.status === 'pending'));

  return (
    <div>
      <div className="page-head">
        <h1>Delivery desk</h1>
        <p>
          Watch deliveries and the rider fleet. Riders choose open jobs themselves; customer details
          become visible to the rider after they accept.
        </p>
      </div>

      {summary && (
        <div className="stat-grid stats">
          {summary.cards.map((c) => (
            <div key={c.key} className={`stat-card${c.accent ? ' accent' : ''}`}>
              <div className="stat-value">{c.key === 'fees' ? money(c.value) : c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <h2>Waiting for a rider ({waiting.length})</h2>
      <p className="section-sub">
        Packed orders stay open until an on-shift rider accepts one. Area and shift status never
        assign a job automatically. Delivery is free.
      </p>
      {waiting.length === 0 ? (
        <p className="empty">Nothing waiting — every order has someone on it.</p>
      ) : (
        <div className="order-list">
          {waiting.map((j) => <JobRow key={j._id} job={j}
            onAdvance={(id, status, code) => guard(() => API.patch(`/delivery/orders/${id}`, { status, otp: code }))}
            onCancel={(id, reason) => guard(() => API.post(`/delivery/orders/${id}/cancel`, { reason }))} />)}
        </div>
      )}

      <h2 className="section">All deliveries ({rest.length})</h2>
      {rest.length === 0 ? (
        <div className="empty-state"><PackageOpen size={34} aria-hidden="true" /><p>No deliveries yet.</p></div>
      ) : (
        <div className="order-list">
          {rest.map((j) => <JobRow key={j._id} job={j}
            onAdvance={(id, status, code) => guard(() => API.patch(`/delivery/orders/${id}`, { status, otp: code }))}
            onCancel={(id, reason) => guard(() => API.post(`/delivery/orders/${id}/cancel`, { reason }))} />)}
        </div>
      )}

      <h2 className="section">Riders ({riders.length})</h2>
      <form className="form narrow" onSubmit={addRider}>
        <h3>Add a delivery partner</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Riders normally sign themselves up on the portal. Review their application in{' '}
          <Link to="/admin/partners">Approvals</Link>. Use this form
          only when someone has no way to register themselves.
        </p>
        <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98XXXXXXXX" /></label>
        <label>Area they cover<input value={form.riderArea} onChange={(e) => setForm({ ...form, riderArea: e.target.value })} placeholder="e.g. Ward 1-5" /></label>
        <label>Vehicle
          <select value={form.riderVehicle} onChange={(e) => setForm({ ...form, riderVehicle: e.target.value })}>
            <option value="">Choose…</option>
            <option>Bike</option>
            <option>Cycle</option>
            <option>Scooter</option>
            <option>On foot</option>
            <option>Other</option>
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        {created && (
          <p className="save-msg">
            <UserPlus size={14} aria-hidden="true" /> {created.rider.name} added. One-time password:{' '}
            <strong>{created.tempPassword}</strong> — share it privately; they should change it after signing in.
          </p>
        )}
        <button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add rider'}</button>
      </form>

      <table className="table">
        <thead><tr><th>Rider</th><th>Area</th><th>Load</th><th>Status</th><th>Supervise</th></tr></thead>
        <tbody>
          {riders.map((r) => (
            <tr key={r._id}>
              <td>{r.name} <small className="muted">({r.riderVehicle || 'rider'})</small></td>
              <td>{r.riderArea || '—'}</td>
              <td>{r.activeJobs}</td>
              <td><span className={`tone-${RIDER_STATUS_TONE[r.riderStatus] || 'muted'}`}>{RIDER_STATUS_LABEL[r.riderStatus] || r.riderStatus}</span></td>
              <td>
                {r.riderStatus === 'suspended' ? (
                  <button onClick={() => setRiderStatus(r._id, 'available')}><Power size={13} aria-hidden="true" /> Reinstate</button>
                ) : r.riderStatus === 'pending' ? (
                  <Link to="/admin/partners">Review in Approvals</Link>
                ) : (
                  <button className="danger" onClick={() => setRiderStatus(r._id, 'suspended')}><Ban size={13} aria-hidden="true" /> Suspend</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
