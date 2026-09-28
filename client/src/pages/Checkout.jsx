import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck, Truck, Clock } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { money } from '../lib/delivery';

export default function Checkout() {
  const { user } = useAuth();
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ line: '', ward: '', phone: '', paymentMethod: 'cod' });
  const [options, setOptions] = useState({ fee: 0, freeOver: 0, slots: [] });
  const [slot, setSlot] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
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

  // Ask the server what delivery costs and which time slots are still promiseable
  // for this ward. The ward changes the price, so this re-runs when it changes.
  useEffect(() => {
    API.get(`/delivery/options?ward=${encodeURIComponent(form.ward)}`)
      .then(({ data }) => {
        setOptions(data);
        setSlot((cur) => (data.slots.some((s) => s.key === cur) ? cur : data.slots[0]?.key || ''));
      })
      .catch(() => {});
  }, [form.ward]);

  // The server recomputes the fee when the order is placed — mirror that here so
  // the number the customer sees is the number they are charged.
  const deliveryFee = options.freeOver && total >= options.freeOver ? 0 : (options.fee || 0);
  const grandTotal = total + deliveryFee;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await API.post('/orders', {
        items: items.map((i) => ({ productId: i.product._id, qty: i.qty })),
        deliveryAddress: { line: form.line, ward: form.ward, phone: form.phone },
        paymentMethod: form.paymentMethod,
        slot: slot || undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
      });
      clear();
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link> to checkout.</p>;
  if (items.length === 0) return <p className="empty">Your cart is khali. <Link to="/">Go shopping</Link></p>;

  const freeHint = options.freeOver > 0
    ? (total >= options.freeOver
      ? 'Free delivery applied to this order.'
      : `Add ${money(options.freeOver - total)} more for free delivery.`)
    : '';

  return (
    <div className="checkout">
      <h1>Checkout</h1>
      <p><strong>Delivery to:</strong> Birgunj{form.ward && `, Ward ${form.ward}`}</p>
      {usingDefault && <p className="save-msg"><CircleCheck size={14} aria-hidden="true" /> Using your saved default address — change it any time in <Link to="/profile">Profile</Link>.</p>}
      <form onSubmit={submit} className="form">
        <label>Address (street / tole)<input required value={form.line} onChange={(e) => { setUsingDefault(false); setForm({ ...form, line: e.target.value }); }} /></label>
        <label>Ward No.<input value={form.ward} onChange={set('ward')} /></label>
        <label>Phone<input required value={form.phone} onChange={(e) => { setUsingDefault(false); setForm({ ...form, phone: e.target.value }); }} placeholder="98XXXXXXXX" /></label>

        <label>When should we deliver?
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>
            {options.slots.length === 0 && <option value="">Next available slot</option>}
            {options.slots.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        {slot && (
          <p className="muted">
            <Clock size={13} aria-hidden="true" /> Promised window:{' '}
            {options.slots.find((s) => s.key === slot)?.label}
          </p>
        )}

        <label>Note for the rider (optional)
          <input
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            maxLength={300}
            placeholder="e.g. Ring the bell twice, gate is on the left"
          />
        </label>

        <label>Payment
          <select value={form.paymentMethod} onChange={set('paymentMethod')}>
            <option value="cod">Cash on Delivery (COD)</option>
            <option value="esewa">eSewa (pay on delivery scan)</option>
          </select>
        </label>
        <div className="bill">
          <p className="bill-row"><span>Items</span><span>{money(total)}</span></p>
          <p className="bill-row">
            <span><Truck size={14} aria-hidden="true" /> Delivery</span>
            <span>{deliveryFee === 0 ? 'Free' : money(deliveryFee)}</span>
          </p>
          {freeHint && <p className="muted bill-hint">{freeHint}</p>}
          <p className="total-row"><strong>Order total: {money(grandTotal)}</strong></p>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit">Place order</button>
      </form>
    </div>
  );
}
