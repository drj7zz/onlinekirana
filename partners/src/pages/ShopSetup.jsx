import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Save, ExternalLink, CircleCheck, TriangleAlert, Image as ImageIcon, UserCircle, KeyRound, Pencil } from 'lucide-react';
import API, { imageUrl } from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import ImageUpload from '@shared/components/ImageUpload';
import { useToast } from '@shared/context/ToastContext';
import { PasswordField, StrengthMeter, checkPassword } from '@shared/components/PasswordSecurity';
import WorkspaceHeader from '../components/WorkspaceHeader.jsx';

const empty = { shopName: '', description: '', phone: '', logoUrl: '', line: '', ward: '', mapsUrl: '', pickupLocation: null };
const emptyPassword = { currentPassword: '', newPassword: '', confirm: '' };

export default function ShopSetup() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState(null);
  const [locating, setLocating] = useState(false);
  const [profile, setProfile] = useState({ name: user?.name || '', phone: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileMessage, setProfileMessage] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [password, setPassword] = useState(emptyPassword);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

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
        mapsUrl: data.mapsUrl || '',
        pickupLocation: data.pickupLocation || null,
      });
    }).catch(() => setMsg({ ok: false, text: 'We could not load your shop details right now. Please refresh and try again.' }));
    API.get('/profile').then(({ data }) => {
      setProfile({ name: data.name || '', phone: data.phone || '' });
      setAvatarUrl(data.avatarUrl || '');
    }).catch(() => setProfileMessage('We could not load your account details. Please refresh and try again.'));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const capturePickup = () => {
    if (!navigator.geolocation) { setMsg({ ok: false, text: 'Location is not available in this browser.' }); return; }
    setLocating(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((f) => ({ ...f, pickupLocation: { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) } }));
        setLocating(false);
      },
      () => { setMsg({ ok: false, text: 'Could not get the shop location. Allow location access and try again.' }); setLocating(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

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
        mapsUrl: form.mapsUrl,
        pickupLocation: form.pickupLocation,
      });
      setShopId(data.id);
      updateUser({ shopName: data.shopName }); // navbar shows the new name immediately
      setMsg({ ok: true, text: 'Shop page updated.' });
      toast.success('Shop page updated');
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setMsg({ ok: false, text: err.response?.data?.message || 'We could not save your shop. Please check the details and try again.' });
      toast.error('Could not save your shop');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileErrors({});
    setProfileMessage('');
    setProfileSaving(true);
    try {
      const { data } = await API.put('/profile', { name: profile.name, phone: profile.phone });
      setProfile({ name: data.name || '', phone: data.phone || '' });
      updateUser({ name: data.name });
      setProfileMessage('Account details saved.');
      toast.success('Account details saved');
    } catch (error) {
      setProfileErrors(error.response?.data?.errors || {});
      setProfileMessage(error.response?.data?.message || 'Could not save your account details.');
      toast.error('Could not save account details');
    } finally {
      setProfileSaving(false);
    }
  };

  const removeAvatar = async () => {
    try {
      await API.delete('/uploads/avatar');
      setAvatarUrl('');
      updateUser({ avatarUrl: '' });
      toast.success('Profile picture removed');
    } catch (error) {
      setProfileMessage(error.response?.data?.message || 'Could not remove your profile picture.');
      toast.error('Could not remove profile picture');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (password.newPassword !== password.confirm) {
      setPasswordMessage({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    const issues = checkPassword(password.newPassword, profile.name, user?.email);
    if (issues.length) {
      setPasswordMessage({ ok: false, text: `Needs: ${issues.join(', ')}` });
      return;
    }
    setPasswordSaving(true);
    try {
      await API.put('/profile/password', { currentPassword: password.currentPassword, newPassword: password.newPassword });
      setPassword(emptyPassword);
      setPasswordMessage({ ok: true, text: 'Password updated.' });
      toast.success('Password updated');
    } catch (error) {
      setPasswordMessage({ ok: false, text: error.response?.data?.message || 'Could not update your password.' });
      toast.error('Could not update password');
    } finally {
      setPasswordSaving(false);
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
    <div className="workspace-page">
      <WorkspaceHeader
        icon={Store}
        eyebrow="Merchant workspace"
        title="Shop setup"
        description="Keep your public shop information up to date for local customers."
      />

      <div className="merchant-settings">
        <details className="workspace-disclosure merchant-shop-disclosure" open>
          <summary><span><Store size={17} aria-hidden="true" /> Shop details</span><small>Edit your public shop page and pickup address</small></summary>
          <div className="workspace-disclosure-body setup-cols workspace-setup-cols">
            <form className="form" onSubmit={save}>
              <label>Shop name
                <input required value={form.shopName} onChange={set('shopName')} />
                {errors.shopName && <span className="field-error">{errors.shopName}</span>}
              </label>
              <label>Description
                <textarea rows={3} maxLength={600} value={form.description} onChange={set('description')}
                  placeholder="What do you sell? Delivery area, timings…" />
              </label>
              <div className="field-row">
                <label>Shop contact phone
                  <input value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </label>
                <label>Ward No. (Birgunj)
                  <input value={form.ward} onChange={set('ward')} placeholder="e.g. 10" />
                </label>
              </div>
              <label>Shop logo</label>
              <ImageUpload endpoint="/uploads/shop-logo" value={form.logoUrl} round size={72}
                label="Upload shop logo" onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))} />
              <label>Shop address — street / tole
                <input value={form.line} onChange={set('line')} placeholder="e.g. Main Road, Birgunj" />
              </label>
              <label>Google Maps link for your shop (optional)
                <input value={form.mapsUrl} onChange={set('mapsUrl')} placeholder="https://maps.app.goo.gl/… or a Google Maps share link" />
                <span className="muted">Customers see a “Find us on Google Maps” button on your shop page.</span>
                {errors.mapsUrl && <span className="field-error">{errors.mapsUrl}</span>}
              </label>
              <div className="location-capture">
                <button type="button" className="muted-btn" onClick={capturePickup} disabled={locating}>
                  {locating ? 'Finding shop location…' : form.pickupLocation ? 'Update pickup pin' : 'Set pickup pin on the map'}
                </button>
                <small className="muted">The exact pin lets riders find your counter and prices late-night delivery. It stays private.</small>
                {form.pickupLocation && (
                  <>
                    <small className="save-msg">Pickup pin saved ({form.pickupLocation.lat}, {form.pickupLocation.lng}).</small>
                    <a
                      className="muted"
                      href={`https://www.google.com/maps?q=${form.pickupLocation.lat},${form.pickupLocation.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                    >
                      <ExternalLink size={13} aria-hidden="true" /> Check the pin on Google Maps
                    </a>
                  </>
                )}
                {errors.pickupLocation && <span className="field-error">{errors.pickupLocation}</span>}
              </div>
              {msg && <p className={msg.ok ? 'save-msg' : 'error'} role="status">{msg.ok ? <CircleCheck size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />} {msg.text}</p>}
              <div className="profile-actions">
                <button type="submit" className="cta-btn" disabled={saving}>
                  <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save shop details'}
                </button>
                {shopId && <Link className="muted-btn" to={`/shop/${shopId}`}><ExternalLink size={14} aria-hidden="true" /> Preview shop</Link>}
              </div>
            </form>

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
        </details>

        <details className="workspace-disclosure">
          <summary><span><UserCircle size={17} aria-hidden="true" /> Personal profile & security</span><small>{profile.name || user.name} · picture, contact and password</small></summary>
          <div className="workspace-disclosure-body merchant-profile-panel">
            <div className="merchant-profile-identity">
              <ImageUpload endpoint="/uploads/avatar" value={avatarUrl} round size={72}
                label="Change picture" onChange={(url) => { setAvatarUrl(url); updateUser({ avatarUrl: url }); }} onRemove={removeAvatar} />
              <div><strong>{profile.name || user.name}</strong><span className="muted">{user.email}</span></div>
              {avatarUrl && <button type="button" className="muted-btn" onClick={removeAvatar}>Remove picture</button>}
            </div>
            <form className="form merchant-personal-form" onSubmit={saveProfile}>
              <div className="field-row">
                <label>Full name
                  <input required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
                  {profileErrors.name && <span className="field-error">{profileErrors.name}</span>}
                </label>
                <label>Contact phone
                  <input inputMode="numeric" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="98XXXXXXXX" />
                  {profileErrors.phone && <span className="field-error">{profileErrors.phone}</span>}
                </label>
              </div>
              {profileMessage && <p className={profileErrors.name || profileErrors.phone ? 'error' : 'save-msg'} role="status">{profileMessage}</p>}
              <button type="submit" className="muted-btn" disabled={profileSaving}><Pencil size={14} aria-hidden="true" /> {profileSaving ? 'Saving…' : 'Save personal details'}</button>
            </form>
            <details className="workspace-disclosure password-disclosure">
              <summary><span><KeyRound size={15} aria-hidden="true" /> Change password</span><small>Optional</small></summary>
              <form className="form workspace-password-form" onSubmit={changePassword}>
                <label>Current password
                  <PasswordField value={password.currentPassword} autoComplete="current-password" onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} />
                </label>
                <label>New password
                  <PasswordField value={password.newPassword} autoComplete="new-password" onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} />
                  <StrengthMeter password={password.newPassword} name={profile.name} email={user.email} />
                </label>
                <label>Confirm new password
                  <PasswordField value={password.confirm} autoComplete="new-password" onChange={(event) => setPassword({ ...password, confirm: event.target.value })} />
                </label>
                {passwordMessage && <p className={passwordMessage.ok ? 'save-msg' : 'error'} role="status">{passwordMessage.text}</p>}
                <button type="submit" className="cta-btn" disabled={passwordSaving}><KeyRound size={15} aria-hidden="true" /> {passwordSaving ? 'Updating…' : 'Update password'}</button>
              </form>
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}
