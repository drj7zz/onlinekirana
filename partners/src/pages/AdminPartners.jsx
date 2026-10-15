import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CircleCheck, Ban } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';

const statusIcon = { pending: <Clock size={14} color="#f9a825" />, approved: <CircleCheck size={14} color="#2e7d32" />, suspended: <Ban size={14} color="#c62828" /> };
const partnerLabel = { pending: 'Pending', approved: 'Approved', suspended: 'Suspended' };

export default function AdminPartners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState([]);
  const [pending, setPending] = useState([]);
  const [riders, setRiders] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

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

  const act = async (key, request) => {
    setBusy(key); setError('');
    try { await request(); await load(); }
    catch (e) { setError(e.response?.data?.message || 'That action could not be completed.'); }
    finally { setBusy(''); }
  };
  const setPartnerStatus = (id, status) => act(id, () => API.patch(`/admin/partners/${id}/status`, { status }));
  const approveRider = (id) => act(id, () => API.patch(`/admin/delivery/riders/${id}/status`, { status: 'available' }));
  const review = (id, status) => act(id, () => API.patch(`/admin/partners/products/${id}/review`, { status }));

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
            <button disabled={busy === p._id} onClick={() => review(p._id, 'approved')}>Approve</button>
            <button className="danger" disabled={busy === p._id} onClick={() => review(p._id, 'rejected')}>Reject</button>
          </div>
        </div>
      ))}
      </section>

      <section className="section">
      <h2>Partner applications ({pendingPartners.length})</h2>
      {pendingPartners.length === 0 ? <p className="empty">No partner applications waiting.</p> : (
        <table className="table">
          <thead><tr><th>Shop</th><th>Contact</th><th>Action</th></tr></thead>
          <tbody>
            {pendingPartners.map((m) => (
              <tr key={m._id}>
                <td>{m.shopName || 'Shop not set up'} <small className="muted">({m.name})</small></td>
                <td>{m.email}{m.phone && ` · ${m.phone}`}</td>
                <td><button disabled={busy === m._id} onClick={() => setPartnerStatus(m._id, 'approved')}>Approve</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </section>

      <section className="section">
        <h2>Rider applications ({pendingRiders.length})</h2>
        {pendingRiders.length === 0 ? <p className="empty">No rider applications waiting.</p> : (
          <table className="table">
            <thead><tr><th>Rider</th><th>Contact</th><th>Area</th><th>Action</th></tr></thead>
            <tbody>
              {pendingRiders.map((r) => (
                <tr key={r._id}>
                  <td>{r.name} <small className="muted">({r.riderVehicle || 'rider'})</small></td>
                  <td>{r.email}{r.phone && ` · ${r.phone}`}</td>
                  <td>{r.riderArea || '—'}</td>
                  <td><button disabled={busy === r._id} onClick={() => approveRider(r._id)}>Approve</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
      <h2>Partner directory ({partners.length})</h2>
      <table className="table">
        <thead><tr><th>Shop</th><th>Contact</th><th>Status</th><th>Regulate</th></tr></thead>
        <tbody>
          {listedPartners.map((m) => (
            <tr key={m._id}>
              <td>{m.shopName} <small className="muted">({m.name})</small></td>
              <td>{m.email}{m.phone && ` · ${m.phone}`}</td>
              <td>{statusIcon[m.merchantStatus]} {partnerLabel[m.merchantStatus]}</td>
              <td>
                {m.merchantStatus === 'approved' && <button className="danger" disabled={busy === m._id} onClick={() => setPartnerStatus(m._id, 'suspended')}>Suspend</button>}{' '}
                {m.merchantStatus === 'suspended' && <button disabled={busy === m._id} onClick={() => setPartnerStatus(m._id, 'pending')}>Re-pend</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </section>
    </div>
  );
}
