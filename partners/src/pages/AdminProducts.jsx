import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock, CircleX } from 'lucide-react';
import API from '@shared/api';
import ImageUpload from '@shared/components/ImageUpload';
import { useAuth } from '@shared/context/AuthContext';
import { SkeletonRows } from '@shared/components/Skeletons';
import { useToast } from '@shared/context/ToastContext';
import SmartImage from '@shared/components/SmartImage';
import { imageUrl } from '@shared/api';
import { Leaf } from 'lucide-react';

const empty = { name: '', category: '', price: '', unit: 'kg', stock: '', imageUrl: '', discountPercent: 0, description: '' };

const STATUS = {
  pending: { label: 'Pending', icon: <Clock size={14} color="var(--warning-accent)" /> },
  approved: { label: 'Live', icon: <CircleCheck size={14} color="var(--success)" /> },
  rejected: { label: 'Rejected', icon: <CircleX size={14} color="var(--danger-strong)" /> },
};

export default function AdminProducts() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => API.get('/admin/products')
    .then((r) => setProducts(r.data))
    .catch((e) => setError(e.response?.data?.message || e.message))
    .finally(() => setLoading(false));
  useEffect(() => { if (user?.role === 'admin') load(); }, [user]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      price: +form.price, stock: +form.stock, discountPercent: +form.discountPercent || 0,
    };
    try {
      if (editId) await API.put(`/admin/products/${editId}`, payload);
      else await API.post('/admin/products', payload);
      setForm(empty); setEditId(null); load();
      toast.success(editId ? 'Product updated' : 'Product added');
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      toast.error('Could not save the product');
    }
  };

  const edit = (p) => {
    setEditId(p._id);
    setForm({
      name: p.name, category: p.category, price: p.price, unit: p.unit,
      stock: p.stock, imageUrl: p.imageUrl, discountPercent: p.discountPercent, description: p.description,
    });
  };

  const del = async (id) => {
    setBusyId(id);
    if (confirm('Delete this product?')) {
      try { await API.delete(`/admin/products/${id}`); load(); toast.success('Product deleted'); }
      catch (e) { setError(e.response?.data?.message || 'Delete failed'); toast.error('Delete failed'); }
    }
    setBusyId(null);
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> as admin.</p>;
  if (user.role !== 'admin') return <p className="empty">Admin access only.</p>;

  return (
    <div>
      <div className="page-head">
        <h1>{editId ? 'Edit product' : 'Add product'}</h1>
        <p>Everything listed here has been reviewed by the operations desk first.</p>
      </div>
      <div className="card-panel">
        <form className="form" onSubmit={submit}>
          <label>Name<input required value={form.name} onChange={set('name')} /></label>
          <label>Category (e.g. Sabzi, Chamal-Dal, Dairy, Masala, Phalphul)<input required value={form.category} onChange={set('category')} /></label>
          <div className="field-row">
            <label>Price (NPR)<input type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} /></label>
            <label>Stock<input type="number" min="0" required value={form.stock} onChange={set('stock')} /></label>
          </div>
          <div className="field-row">
            <label>Unit
              <select value={form.unit} onChange={set('unit')}>
                {['kg', 'litre', 'packet', 'piece', 'dori', 'gatta'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label>Discount %<input type="number" min="0" max="90" value={form.discountPercent} onChange={set('discountPercent')} /></label>
          </div>
          <label>Product photo</label>
          <ImageUpload endpoint="/uploads/product" value={form.imageUrl} size={104}
            label="Upload photo" onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
          <label>Description<textarea value={form.description} onChange={set('description')} /></label>
          {error && <p className="error">{error}</p>}
          <div className="profile-actions">
            <button type="submit" className="cta-btn">{editId ? 'Update product' : 'Add product'}</button>
            {editId && <button type="button" className="muted-btn" onClick={() => { setEditId(null); setForm(empty); }}>Cancel edit</button>}
          </div>
        </form>
      </div>

      <h2 className="section">Products ({products.length})</h2>
      {loading ? (
        <SkeletonRows n={4} cols={4} />
      ) : products.length === 0 ? (
        <p className="empty">No products in the catalogue yet.</p>
      ) : (
        <div className="prod-rows">
          {products.map((p) => (
            <div key={p._id} className="prod-row">
              <div className="prod-row-media">
                <SmartImage
                  src={imageUrl(p.imageUrl)}
                  alt=""
                  imgCls="prod-row-thumb"
                  fallbackCls="prod-row-thumb prod-row-thumb-fallback"
                  fallback={<Leaf size={18} aria-hidden="true" />}
                />
              </div>
              <div className="prod-row-main">
                <strong>{p.name}</strong>
                <span className="muted">{p.category} · NPR ₹ {p.price}/{p.unit} · stock {p.stock}</span>
              </div>
              <span className="status s-pending">{STATUS[p.status]?.icon} {STATUS[p.status]?.label || p.status}</span>
              <div className="prod-row-actions">
                <button className="muted-btn" disabled={busyId === p._id} onClick={() => { edit(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                <button className="danger" disabled={busyId === p._id} onClick={() => del(p._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
