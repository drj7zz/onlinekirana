import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle, Save, KeyRound, CircleCheck, TriangleAlert, Store, Bike, ShieldCheck } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { PasswordField, StrengthMeter, checkPassword } from '@shared/components/PasswordSecurity';
import ImageUpload from '@shared/components/ImageUpload';
import useSeo from '@shared/hooks/useSeo';

/**
 * Partner profile.
 *
 * Deliberately a mirror of the storefront's Profile page and built from the same
 * `.profile-*` / `.card-panel` / `.form` classes, so "my profile" is one recognisable
 * screen in both apps. What differs by necessity:
 *
 *  - There is no delivery address. A shopper's street/ward is what makes an order
 *    deliverable; a partner has a shop, not a delivery address. The shop's own
 *    details live on /shop-setup, which is the one screen that can write them.
 *  - The workspace shortcut points at whichever orders route this role owns, since
 *    a merchant and an admin both have one but by different paths.
 *
 * Note on scope: `PUT /api/profile` persists only name, phone and address. It has
 * no shopName field, so nothing here tries to save one — an editable field the API
 * ignores would render as "saved" while quietly discarding the input. Merchants get
 * a link to /shop-setup instead, which does save the shop.
 */

const emptyForm = { name: '', phone: '' };
const emptyPw = { currentPassword: '', newPassword: '', confirm: '' };

/** Where "my orders" lives for each role. */
const ORDERS_ROUTE = {
  merchant: '/orders',
  admin: '/admin/orders',
  delivery: '/rider',
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [pw, setPw] = useState(emptyPw);
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState(null); // { ok, text }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  useSeo({
    title: 'My Profile — OnlineKirana Partners',
    description: 'Update your photo, contact details and password on your OnlineKirana partner account.',
    noindex: true,
  });

  // load the full profile on mount
  useEffect(() => {
    API.get('/profile').then(({ data }) => {
      setForm({ name: data.name || '', phone: data.phone || '' });
      setAvatarUrl(data.avatarUrl || '');
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setErrors({}); setSaving(true);
    try {
      const { data } = await API.put('/profile', { name: form.name, phone: form.phone });
      updateUser({ name: data.name });
      setMsg('Profile saved.');
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setMsg(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.newPassword !== pw.confirm) { setPwMsg({ ok: false, text: 'New passwords do not match' }); return; }
    const issues = checkPassword(pw.newPassword, form.name, user?.email);
    if (issues.length) { setPwMsg({ ok: false, text: `Needs: ${issues.join(', ')}` }); return; }
    setPwSaving(true);
    try {
      await API.put('/profile/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw(emptyPw);
      setPwMsg({ ok: true, text: 'Password updated' });
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Password change failed' });
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link>.</p>;

  const ordersTo = ORDERS_ROUTE[user.role];
  const RoleIcon = user.role === 'merchant' ? Store : user.role === 'delivery' ? Bike : ShieldCheck;

  return (
    <div className="profile-page">
      {/* The `.page-head` block is the standard page opening used across both apps:
          title plus a one-line explanation of what the screen is for. The identity
          row below it carries the avatar, name and role. */}
      <div className="page-head">
        <h1>My profile</h1>
        <p>Your photo, contact number and password for the OnlineKirana partner portal.</p>
      </div>

      <div className="profile-head">
        <ImageUpload endpoint="/uploads/avatar" value={avatarUrl} round size={88}
          label="Upload photo" onChange={(url) => { setAvatarUrl(url); updateUser({ avatarUrl: url }); }} />
        <div>
          <h2>{user.name}</h2>
          <p className="muted">{user.email}</p>
          <span className={`role-chip role-${user.role}`}>{user.role}</span>
        </div>
      </div>

      {ordersTo && (
        <Link to={ordersTo} className="card-panel profile-orders-link">
          <RoleIcon size={19} className="action-icon" aria-hidden="true" />
          <strong>{user.role === 'delivery' ? 'My shift' : 'Orders'}</strong>
          <span className="muted">
            {user.role === 'merchant' ? 'Pack orders, hand them to a rider and track payouts — go to shop orders →'
              : user.role === 'delivery' ? 'Pick up, deliver and log your earnings — go to my shift →'
                : 'Oversee every order across the marketplace — go to orders →'}
          </span>
        </Link>
      )}

      <section className="card-panel">
        <h2><UserCircle size={19} className="action-icon" aria-hidden="true" />Personal info</h2>
        <p className="muted">The operations desk uses this number to reach you about orders and approvals.</p>
        <form className="form" onSubmit={saveProfile}>
          <label>Full name
            <input required value={form.name} onChange={set('name')} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label>Phone
            <input value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          {msg && <p className="save-msg"><CircleCheck size={14} aria-hidden="true" /> {msg}</p>}
          {Object.keys(errors).length > 0 && !msg && <p className="error"><TriangleAlert size={14} aria-hidden="true" /> Fix the highlighted fields</p>}
          <button type="submit" className="cta-btn" disabled={saving}>
            <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
        {user.role === 'merchant' && (
          /* The shop's name, logo, description and contact live on their own
             screen — `PUT /profile` cannot write them, so this is a link, not a
             field that would appear to save and quietly do nothing. */
          <p className="muted" style={{ marginTop: '.6rem' }}>
            <Store size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Shop name, logo and contact details live in{' '}
            <Link to="/shop-setup" className="shop-link">shop setup</Link>.
          </p>
        )}
      </section>

      <section className="card-panel">
        <h2><KeyRound size={19} className="action-icon" aria-hidden="true" />Change password</h2>
        <form className="form" onSubmit={changePw}>
          <label>Current password
            <PasswordField value={pw.currentPassword} autoComplete="current-password"
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </label>
          <label>New password
            <PasswordField value={pw.newPassword} autoComplete="new-password"
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            <StrengthMeter password={pw.newPassword} name={form.name} email={user.email} />
          </label>
          <label>Confirm new password
            <PasswordField value={pw.confirm} autoComplete="new-password"
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </label>
          {pwMsg && <p className={pwMsg.ok ? 'save-msg' : 'error'}>{pwMsg.ok ? <CircleCheck size={14} aria-hidden="true" /> : <TriangleAlert size={14} aria-hidden="true" />} {pwMsg.text}</p>}
          <button type="submit" disabled={pwSaving}><KeyRound size={15} aria-hidden="true" /> {pwSaving ? 'Updating…' : 'Update password'}</button>
        </form>
      </section>
    </div>
  );
}
