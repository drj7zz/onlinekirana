import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, CircleCheck, CircleX, PackageOpen } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../hooks/useLive';
import ImageUpload from '../components/ImageUpload';
import OrderCard from '../components/OrderCard';

const empty = { name: '', category: '', price: '', unit: 'kg', stock: '', imageUrl: '', discountPercent: 0, description: '' };

const statusIcon = { pending: <Clock size={14} color="#f9a825" />, approved: <CircleCheck size={14} color="#2e7d32" />, rejected: <CircleX size={14} color="#c62828" /> };
const statusLabel = { pending: 'Pending review', approved: 'Live in shop', rejected: 'Not approved' };

export default function Partners() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('products');

  const load = () => {
    API.get('/partner/products').then((r) => setProducts(r.data)).catch(() => setError('We could not load your products right now. Please try again.'));
    API.get('/partner/orders').then((r) => setOrders(r.data)).catch(() => {});
  };
  // live updates: approval status changes appear automatically
  useLive(load, 8000, [user?._id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, price: +form.price, stock: +form.stock, discountPercent: +form.discountPercent || 0 };
    try {
      if (editId) await API.put(`/partner/products/${editId}`, payload);
      else await API.post('/partner/products', payload);
      setForm(empty); setEditId(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'We could not save your product. Please check the details and try again.');
    }
  };

  const edit = (p) => {
    setEditId(p._id);
    setForm({ name: p.name, category: p.category, price: p.price, unit: p.unit, stock: p.stock, imageUrl: p.imageUrl, discountPercent: p.discountPercent, description: p.description });
  };

  const del = async (id) => { if (confirm('Remove this product?')) { await API.delete(`/partner/products/${id}`); load(); } };

  const setOrderStatus = async (id, status) => { await API.patch(`/partner/orders/${id}/status`, { status }); load(); };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> with a merchant account, or <Link to="/register?partner=1">register as a partner</Link>.</p>;
  if (user.role !== 'merchant') return <p className="empty">This dashboard is for merchant partners only.</p>;
  if (user.merchantStatus !== 'approved') {
    return (
      <div className="empty">
        <h1>{user.shopName}</h1>
        <p>Your partner account is <strong>{user.merchantStatus}</strong>. New partner shops are reviewed before they go live. You&apos;ll be able to list products once approved.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>{user.shopName} — Partner Dashboard</h1>
      <p className="muted">Add and update your products, and manage the orders placed with your shop.</p>

      <div className="filters">
        <button className={tab === 'products' ? '' : 'muted-btn'} onClick={() => setTab('products')}>My Products ({products.length})</button>
        <button className={tab === 'orders' ? '' : 'muted-btn'} onClick={() => setTab('orders')}>Orders ({orders.length})</button>
      </div>

      {tab === 'products' && (
        <>
          <h2>{editId ? 'Edit product' : 'Add product'}</h2>
          <form className="form" onSubmit={submit}>
            <label>Name<input required value={form.name} onChange={set('name')} /></label>
            <label>Category<input required value={form.category} onChange={set('category')} /></label>
            <label>Price (NPR)<input type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} /></label>
            <label>Unit
              <select value={form.unit} onChange={set('unit')}>
                {['kg', 'litre', 'packet', 'piece', 'dori', 'gatta'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>Stock<input type="number" min="0" required value={form.stock} onChange={set('stock')} /></label>
            <label>Discount %<input type="number" min="0" max="90" value={form.discountPercent} onChange={set('discountPercent')} /></label>
            <label>Product photo</label>
            <ImageUpload endpoint="/uploads/product" value={form.imageUrl} size={104}
              label="Upload photo" onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
            <label>Description<textarea value={form.description} onChange={set('description')} /></label>
            {error && <p className="error">{error}</p>}
            <button type="submit">{editId ? 'Update product' : 'Submit for approval'}</button>
            {editId && <button type="button" className="muted-btn" onClick={() => { setEditId(null); setForm(empty); }}>Cancel edit</button>}
          </form>

          <table className="table">
            <thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>रू {p.price}/{p.unit}</td>
                  <td>{p.stock}</td>
                  <td>{statusIcon[p.status]} {statusLabel[p.status]}</td>
                  <td>
                    <button onClick={() => edit(p)}>Edit</button>{' '}
                    <button className="danger" onClick={() => del(p._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'orders' && (
        orders.length === 0 ? (
          <div className="empty-state">
            <PackageOpen size={32} aria-hidden="true" />
            <p>No orders with your items yet. When customers buy from your shop, their orders appear here with a delivery tracker.</p>
          </div>
        ) : (
          <div className="order-list">
            {orders.map((o) => (
              <OrderCard
                key={o._id}
                order={o}
                viewer="merchant"
                allowedStatuses={['packed', 'out_for_delivery', 'delivered']}
                onStatus={setOrderStatus}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
