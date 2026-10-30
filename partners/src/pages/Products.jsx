import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CircleCheck, CircleX, Leaf } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import ImageUpload from '@shared/components/ImageUpload';
import SmartImage from '@shared/components/SmartImage';
import { SkeletonRows } from '@shared/components/Skeletons';
import { useToast } from '@shared/context/ToastContext';
import { imageUrl } from '@shared/api';

const empty = { name: '', category: '', price: '', unit: 'kg', stock: '', imageUrl: '', discountPercent: 0, description: '' };

const statusIcon = { pending: <Clock size={14} color="#fbbf24" />, approved: <CircleCheck size={14} color="#4ade80" />, rejected: <CircleX size={14} color="#f87171" /> };
const statusLabel = { pending: 'Pending review', approved: 'Live in shop', rejected: 'Not approved' };

/**
 * One catalogue row. Photo thumbnails give the list a face; edit/delete sit on
 * the right so the row reads "what it is → what you can do with it".
 */
function ProductRow({ p, onEdit, onDelete, busy }) {
  return (
    <div className="prod-row">
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
        <span className="muted">{p.category} · रू {Number(p.price).toLocaleString('en-IN')}/{p.unit} · stock {p.stock}</span>
      </div>
      <span className={`status s-${p.status}`}>{statusIcon[p.status]} {statusLabel[p.status]}</span>
      <div className="prod-row-actions">
        <button className="muted-btn" disabled={busy === p._id} onClick={() => onEdit(p)}>Edit</button>
        <button className="danger" disabled={busy === p._id} onClick={() => onDelete(p._id)}>Delete</button>
      </div>
    </div>
  );
}

/** Merchant product catalogue: submit, edit and retire what this shop sells. */
export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    API.get('/partner/products')
      .then((r) => setProducts(r.data))
      .catch(() => setError('We could not load your products right now. Please try again.'))
      .finally(() => setLoading(false));
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
      toast.success(editId ? 'Product updated' : 'Submitted for approval');
    } catch (err) {
      setError(err.response?.data?.message || 'We could not save your product. Please check the details and try again.');
      toast.error('Could not save the product');
    }
  };

  const del = async (id) => {
    setBusyId(id);
    if (confirm('Remove this product?')) {
      try { await API.delete(`/partner/products/${id}`); load(); toast.success('Product removed'); }
      catch { setError('Could not remove that product.'); toast.error('Could not remove that product'); }
    }
    setBusyId(null);
  };

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

      {/* The add/edit form is a card so it reads as one unit; paired numeric
          fields share rows to keep it short. */}
      <div className="card-panel">
        <h2>{editId ? 'Edit product' : 'Add product'}</h2>
        <form className="form" onSubmit={submit}>
          <label>Name<input required value={form.name} onChange={set('name')} /></label>
          <label>Category<input required value={form.category} onChange={set('category')} /></label>
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
            <button type="submit" className="cta-btn">{editId ? 'Update product' : 'Submit for approval'}</button>
            {editId && <button type="button" className="muted-btn" onClick={() => { setEditId(null); setForm(empty); }}>Cancel edit</button>}
          </div>
        </form>
      </div>

      <h2 className="section">Catalogue ({products.length})</h2>
      {loading ? (
        <SkeletonRows n={4} cols={3} />
      ) : products.length === 0 ? (
        <p className="empty">Nothing listed yet — add your first product above.</p>
      ) : (
        <div className="prod-rows">
          {products.map((p) => (
            <ProductRow key={p._id} p={p} busy={busyId}
              onEdit={(prod) => { setEditId(prod._id); setForm({ name: prod.name, category: prod.category, price: prod.price, unit: prod.unit, stock: prod.stock, imageUrl: prod.imageUrl, discountPercent: prod.discountPercent, description: prod.description }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              onDelete={del}
            />
          ))}
        </div>
      )}
    </div>
  );
}
