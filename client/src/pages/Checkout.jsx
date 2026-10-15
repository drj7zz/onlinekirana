import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck, Truck, Clock, MapPin } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { money } from '../lib/delivery';

export default function Checkout() {
  const { user } = useAuth();
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ line: '', ward: '', phone: '' });
  const [options, setOptions] = useState({ slots: [], pilotPricing: true });
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [cancellationPolicy, setCancellationPolicy] = useState(null);
  const [slot, setSlot] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [error, setError] = useState('');
  const [slotError, setSlotError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [usingDefault, setUsingDefault] = useState(false);
  const merchant = items[0]?.product?.merchant;
  const sellerId = merchant ? String(typeof merchant === 'object' ? merchant._id : merchant) : 'platform';

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

  useEffect(() => {
    API.get('/orders/cancellation-status').then(({ data }) => setCancellationPolicy(data)).catch(() => {});
  }, []);

  // The server controls time windows, rider availability and all delivery fees.
  useEffect(() => {
    let current = true;
    setSlotError('');
    const params = new URLSearchParams({ sellerId });
    if (location) { params.set('lat', location.lat); params.set('lng', location.lng); }
    API.get(`/delivery/options?${params}`)
      .then(({ data }) => {
        if (!current) return;
        setOptions(data);
        setSlot((cur) => (data.slots.some((s) => s.key === cur) ? cur : data.slots[0]?.key || ''));
        setSlotError(data.slots?.length ? '' : 'No delivery windows are available right now. Please try again later.');
      })
      .catch(() => { if (current) setSlotError('Could not load delivery windows. Check your connection and try again.'); });
    return () => { current = false; };
  }, [sellerId, location?.lat, location?.lng]);

  const selectedSlot = options.slots.find((s) => s.key === slot);
  const deliveryFee = Number(selectedSlot?.fee || 0);
  const grandTotal = total + deliveryFee;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const captureLocation = () => {
    if (!navigator.geolocation) { setError('Location is not available in this browser.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) });
        setLocating(false);
      },
      () => { setError('Could not get your location. Allow location access and try again.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (slotError) { setError(slotError); return; }
    setSubmitting(true);
    try {
      const { data: placedOrder } = await API.post('/orders', {
        items: items.map((i) => ({ productId: i.product._id, qty: i.qty })),
        deliveryAddress: { line: form.line, ward: form.ward, phone: form.phone, location },
        paymentMethod: 'cod',
        slot: slot || undefined,
        quotedDeliveryFee: deliveryFee,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
      });
      clear();
      sessionStorage.setItem('ok_last_order', JSON.stringify({ id: placedOrder._id, createdAt: placedOrder.createdAt }));
      navigate('/orders?placed=1');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    } finally { setSubmitting(false); }
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

        <div className="location-capture">
          <button type="button" className="muted-btn" onClick={captureLocation} disabled={locating}>
            <MapPin size={14} aria-hidden="true" /> {locating ? 'Finding your location…' : location ? 'Update delivery pin' : 'Add delivery pin'}
          </button>
          <small className="muted">A location pin is needed for late-night distance pricing. It is shared with your rider only after they accept.</small>
          {location && <small className="save-msg">Delivery pin saved.</small>}
        </div>

        <label>Delivery window
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>
            {options.slots.length === 0 && <option value="">Next available slot</option>}
            {options.slots.map((s) => <option key={s.key} value={s.key}>{s.label}{s.fee ? ` · ${money(s.fee)}` : ''}</option>)}
          </select>
        </label>
        {slot && (
          <p className="muted">
            <Clock size={13} aria-hidden="true" /> Selected delivery window: {selectedSlot?.label}. {deliveryFee ? `Delivery charge: ${money(deliveryFee)}.` : 'Delivery charge: Free.'}
          </p>
        )}
        {options.pilotPricing && options.distanceKm != null && selectedSlot?.fee > 0 && <p className="muted">About {options.distanceKm} km straight-line estimate at रू {options.ratePerKm}/km. The route distance may differ.</p>}
        {options.pilotPricing && !options.riderOnline && <p className="muted">Paid late-night delivery appears only while an approved rider is online.</p>}
        {options.pilotPricing && options.riderOnline && !location && <p className="muted">Add a delivery pin to see the late-night delivery option.</p>}
        {options.pilotPricing && options.riderOnline && location && !options.hasPickupLocation && <p className="muted">Late-night pricing is unavailable until this shop saves its pickup pin.</p>}

        <label>Note for the rider (optional)
          <input
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            maxLength={300}
            placeholder="e.g. Ring the bell twice, gate is on the left"
          />
        </label>

        <label>Payment
          <span className="muted">Pay cash after you receive the order. No advance online payment.</span>
        </label>
        <div className="bill">
          <p className="bill-row"><span>Items</span><span>{money(total)}</span></p>
          <p className="bill-row">
            <span><Truck size={14} aria-hidden="true" /> Delivery</span>
            <span>{deliveryFee === 0 ? 'Free' : money(deliveryFee)}</span>
          </p>
          <p className="total-row"><strong>Order total: {money(grandTotal)}</strong></p>
        </div>
        {cancellationPolicy?.enabled && cancellationPolicy.warning && <p className="error" role="status">You have {cancellationPolicy.recentCount} qualifying cancellations in the last {cancellationPolicy.windowDays} days. A third cancellation pauses ordering for {cancellationPolicy.restrictionDays || 7} days.</p>}
        {cancellationPolicy?.restrictedUntil && <p className="error" role="alert">Ordering is paused until {new Date(cancellationPolicy.restrictedUntil).toLocaleDateString()}. Contact support to request a review.</p>}
        {slotError && <p className="muted">{slotError}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || Boolean(slotError) || !slot || Boolean(cancellationPolicy?.restrictedUntil)}>{submitting ? 'Placing order…' : 'Place order'}</button>
      </form>
    </div>
  );
}
