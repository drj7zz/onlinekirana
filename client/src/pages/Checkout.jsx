import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Checkout() {
  const { user } = useAuth();
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ line: '', ward: '', phone: '', paymentMethod: 'cod' });
  const [error, setError] = useState('');
  const [usingDefault, setUsingDefault] = useState(false);

  // prefill from the profile's saved default address
  useEffect(() => {
    API.get('/profile').then(({ data }) => {
      setForm((f) => ({
        ...f,
        line: data.address?.line || '',
        ward: data.address?.ward || '',
        phone: data.phone || '',
      }));
      setUsingDefault(Boolean(data.address?.line || data.phone));
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.post('/orders', {
        items: items.map((i) => ({ productId: i.product._id, qty: i.qty })),
        deliveryAddress: { line: form.line, ward: form.ward, phone: form.phone },
        paymentMethod: form.paymentMethod,
      });
      clear();
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to checkout.</p>;
  if (items.length === 0) return <p className="empty">Your cart is khali. <Link to="/">Go shopping</Link></p>;

  return (
    <div className="checkout">
      <h1>Checkout</h1>
      <p><strong>Delivery to:</strong> Birgunj{form.ward && `, Ward ${form.ward}`}</p>
      {usingDefault && <p className="save-msg"><CircleCheck size={14} aria-hidden="true" /> Using your saved default address — change it any time in <Link to="/profile">Profile</Link>.</p>}
      <form onSubmit={submit} className="form">
        <label>Address (street / tole)<input required value={form.line} onChange={(e) => { setUsingDefault(false); setForm({ ...form, line: e.target.value }); }} /></label>
        <label>Ward No.<input value={form.ward} onChange={set('ward')} /></label>
        <label>Phone<input required value={form.phone} onChange={(e) => { setUsingDefault(false); setForm({ ...form, phone: e.target.value }); }} placeholder="98XXXXXXXX" /></label>
        <label>Payment
          <select value={form.paymentMethod} onChange={set('paymentMethod')}>
            <option value="cod">Cash on Delivery (COD)</option>
            <option value="esewa">eSewa (pay on delivery scan)</option>
          </select>
        </label>
        <p className="total-row"><strong>Order total: रू {total.toFixed(2)}</strong></p>
        {error && <p className="error">{error}</p>}
        <button type="submit">Place order</button>
      </form>
    </div>
  );
}
