import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CircleCheck, CircleX } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import ImageUpload from '@shared/components/ImageUpload';

const empty = { name: '', category: '', price: '', unit: 'kg', stock: '', imageUrl: '', discountPercent: 0, description: '' };

const statusIcon = { pending: <Clock size={14} color="#fbbf24" />, approved: <CircleCheck size={14} color="#4ade80" />, rejected: <CircleX size={14} color="#f87171" /> };
const statusLabel = { pending: 'Pending review', approved: 'Live in shop', rejected: 'Not approved' };

/** Merchant product catalogue: submit, edit and retire what this shop sells. */
export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    API.get('/partner/products').then((r) => setProducts(r.data)).catch(() => setError('We could not load your products right now. Please try again.'));
  };
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

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to manage your products.</p>;
  if (user.role !== 'merchant') return <p className="empty">The product catalogue is for merchant partners only.</p>;
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
      <h1>My products</h1>
      <p className="muted">Add and update what your shop sells. New items go live once the operations desk approves them.</p>

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

      <h1>Catalogue ({products.length})</h1>
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
    </div>
  );
}
