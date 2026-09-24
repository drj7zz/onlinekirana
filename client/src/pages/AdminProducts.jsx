import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock, CircleX } from 'lucide-react';
import API from '../api';
import ImageUpload from '../components/ImageUpload';
import { useAuth } from '../context/AuthContext';

const empty = { name: '', category: '', price: '', unit: 'kg', stock: '', imageUrl: '', discountPercent: 0, description: '' };

export default function AdminProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const load = () => API.get('/admin/products').then((r) => setProducts(r.data)).catch((e) => setError(e.response?.data?.message || e.message));
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
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  };

  const edit = (p) => {
    setEditId(p._id);
    setForm({
      name: p.name, category: p.category, price: p.price, unit: p.unit,
      stock: p.stock, imageUrl: p.imageUrl, discountPercent: p.discountPercent, description: p.description,
    });
  };

  const del = async (id) => { if (confirm('Delete this product?')) { await API.delete(`/admin/products/${id}`); load(); } };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> as admin.</p>;
  if (user.role !== 'admin') return <p className="empty">Admin access only.</p>;

  return (
    <div>
      <h1>{editId ? 'Edit product' : 'Add product'}</h1>
      <form className="form" onSubmit={submit}>
        <label>Name<input required value={form.name} onChange={set('name')} /></label>
        <label>Category (e.g. Sabzi, Chamal-Dal, Dairy, Masala, Phalphul)<input required value={form.category} onChange={set('category')} /></label>
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
        <button type="submit">{editId ? 'Update' : 'Add'}</button>
        {editId && <button type="button" className="muted-btn" onClick={() => { setEditId(null); setForm(empty); }}>Cancel edit</button>}
      </form>

      <h1>Products ({products.length})</h1>
      <table className="table">
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {products.map((p) => (
            <tr key={p._id}>
              <td>{p.name}</td>
              <td>{p.category}</td>
              <td>रू {p.price}/{p.unit}</td>
              <td>{p.stock}</td>
              <td className="status-cell">
                {p.status === 'approved' ? <CircleCheck size={16} color="#2e7d32" aria-label="approved" />
                  : p.status === 'pending' ? <Clock size={16} color="#f9a825" aria-label="pending" />
                  : <CircleX size={16} color="#c62828" aria-label="rejected" />}
              </td>
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
