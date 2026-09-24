import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Save, ExternalLink, CircleCheck, TriangleAlert, Image as ImageIcon } from 'lucide-react';
import API, { imageUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';

const empty = { shopName: '', description: '', phone: '', logoUrl: '', line: '', ward: '' };

export default function ShopSetup() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState(null);

  useEffect(() => {
    API.get('/partner/shop').then(({ data }) => {
      setShopId(data.id);
      setForm({
        shopName: data.shopName || '',
        description: data.description || '',
        phone: data.phone || '',
        logoUrl: data.logoUrl || '',
        line: data.address?.line || '',
        ward: data.address?.ward || '',
      });
    }).catch(() => setMsg({ ok: false, text: 'We could not load your shop details right now. Please refresh and try again.' }));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setMsg(null); setErrors({}); setSaving(true);
    try {
      const { data } = await API.put('/partner/shop', {
        shopName: form.shopName,
        description: form.description,
        phone: form.phone,
        logoUrl: form.logoUrl,
        address: { line: form.line, ward: form.ward },
      });
      setShopId(data.id);
      updateUser({ shopName: data.shopName }); // navbar shows the new name immediately
      setMsg({ ok: true, text: 'Shop page updated.' });
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setMsg({ ok: false, text: err.response?.data?.message || 'We could not save your shop. Please check the details and try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link>.</p>;
  if (user.role !== 'merchant') return <p className="empty">Shop setup is for merchant partners only.</p>;
  if (user.merchantStatus !== 'approved') {
    return (
      <div className="empty">
        <h1>{user.shopName}</h1>
        <p>Your partner account is <strong>{user.merchantStatus}</strong>. The OnlineKirana admin reviews new partners before their shop page goes live.</p>
      </div>
    );
  }

  return (
    <div>
      <h1><Store size={22} className="action-icon" aria-hidden="true" />Shop setup</h1>
      <p className="muted">This information appears on your public shop page — the page customers open from your products.</p>

      <div className="setup-cols">
        <form className="form" onSubmit={save}><label>Shop name
            <input required value={form.shopName} onChange={set('shopName')} />
            {errors.shopName && <span className="field-error">{errors.shopName}</span>}
          </label>
          <label>Description
            <textarea rows={4} maxLength={600} value={form.description} onChange={set('description')}
              placeholder="What do you sell? Delivery area, timings…" />
          </label>
          <label>Shop contact phone
            <input value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label>Shop logo</label>
          <ImageUpload endpoint="/uploads/shop-logo" value={form.logoUrl} round size={84}
            label="Upload logo" onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))} />
          <label>Shop address — street / tole
            <input value={form.line} onChange={set('line')} placeholder="e.g. Main Road, Adarsh Nagar" />
          </label>
          <label>Ward No. (Birgunj)
            <input value={form.ward} onChange={set('ward')} placeholder="e.g. 10" />
          </label>
          {msg && <p className={msg.ok ? 'save-msg' : 'error'}>{msg.ok ? <CircleCheck size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />} {msg.text}</p>}
          <button type="submit" className="cta-btn" disabled={saving}>
            <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save shop'}
          </button>
          {shopId && (
            <p className="muted">
              <ExternalLink size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" />{' '}
              <Link to={`/shop/${shopId}`}>View your public shop page</Link>
            </p>
          )}
        </form>

        {/* live preview of the public shop header */}
        <div className="shop-hero">
          {form.logoUrl
            ? <img src={imageUrl(form.logoUrl)} alt="Shop logo" className="shop-logo" />
            : <div className="shop-logo shop-logo-fallback"><ImageIcon size={26} aria-hidden="true" /></div>}
          <div className="shop-hero-info">
            <h1>{form.shopName || 'Your shop name'}</h1>
            <p>{form.description || 'Your shop description will appear here.'}</p>
            <p className="muted">
              {(form.line || form.ward) ? `${form.line}${form.ward ? `, Ward ${form.ward}` : ''}, Birgunj` : 'Shop address, Birgunj'}
              {form.phone && ` · ${form.phone}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
