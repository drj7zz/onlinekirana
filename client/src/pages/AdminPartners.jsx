import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CircleCheck, Ban, CircleX } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';

const statusIcon = { pending: <Clock size={14} color="#f9a825" />, approved: <CircleCheck size={14} color="#2e7d32" />, suspended: <Ban size={14} color="#c62828" /> };
const partnerLabel = { pending: 'Pending', approved: 'Approved', suspended: 'Suspended' };
const prodLabel = { pending: 'Pending review', approved: 'Live', rejected: 'Rejected' };
const prodIcon = { pending: <Clock size={14} color="#f9a825" />, approved: <CircleCheck size={14} color="#2e7d32" />, rejected: <CircleX size={14} color="#c62828" /> };

export default function AdminPartners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState([]);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');

  const load = () => {
    API.get('/admin/partners').then((r) => setPartners(r.data)).catch((e) => setError(e.response?.data?.message || e.message));
    API.get('/admin/partners/pending-products').then((r) => setPending(r.data)).catch(() => {});
  };
  // live updates: new submissions / applications appear automatically
  useLive(load, 6000, [user?._id]);

  const setPartnerStatus = async (id, status) => { await API.patch(`/admin/partners/${id}/status`, { status }); load(); };
  const review = async (id, status) => { await API.patch(`/admin/partners/products/${id}/review`, { status }); load(); };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> as admin.</p>;
  if (user.role !== 'admin') return <p className="empty">Admin access only.</p>;

  return (
    <div>
      <h1>Product approvals ({pending.length})</h1>
      <p className="muted">Submissions from merchant partners. Approve to make them live in the shop, or reject.</p>
      {pending.length === 0 && <p className="empty">Nothing waiting for review.</p>}
      {pending.map((p) => (
        <div key={p._id} className="order-card">
          <div className="order-head">
            <strong>{p.name}</strong>
            <span>{p.category} · रू {p.price}/{p.unit} · stock {p.stock}</span>
            <span className="muted">by {p.merchant?.shopName || p.merchant?.name || 'unknown'}</span>
          </div>
          <p>{p.description}</p>
          <div className="order-head" style={{ marginTop: '.5rem' }}>
            <button onClick={() => review(p._id, 'approved')}>Approve</button>
            <button className="danger" onClick={() => review(p._id, 'rejected')}>Reject</button>
          </div>
        </div>
      ))}

      <h1 style={{ marginTop: '2rem' }}>Merchant partners ({partners.length})</h1>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Shop</th><th>Contact</th><th>Status</th><th>Regulate</th></tr></thead>
        <tbody>
          {partners.map((m) => (
            <tr key={m._id}>
              <td>{m.shopName} <small className="muted">({m.name})</small></td>
              <td>{m.email}{m.phone && ` · ${m.phone}`}</td>
              <td>{statusIcon[m.merchantStatus]} {partnerLabel[m.merchantStatus]}</td>
              <td>
                {m.merchantStatus !== 'approved' && <button onClick={() => setPartnerStatus(m._id, 'approved')}>Approve</button>}{' '}
                {m.merchantStatus === 'approved' && <button className="danger" onClick={() => setPartnerStatus(m._id, 'suspended')}>Suspend</button>}{' '}
                {m.merchantStatus === 'suspended' && <button onClick={() => setPartnerStatus(m._id, 'pending')}>Re-pend</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
