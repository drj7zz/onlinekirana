import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, KeyRound, CircleCheck, TriangleAlert, Package, Heart, Camera, Pencil, Trash2, ChevronDown, LogOut } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PasswordField, StrengthMeter, checkPassword } from '../components/PasswordSecurity';
import { imageUrl } from '../api';

const emptyForm = { name: '', phone: '', line: '', ward: '' };
const emptyPw = { currentPassword: '', newPassword: '', confirm: '' };

/** Minimal headless image picker: exposes its file input to the parent's menu. */
function AvatarPicker({ endpoint, onUploaded }, ref) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  useImperativeHandle(ref, () => ({ click: () => inputRef.current?.click() }), []);
  const pick = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    if (file.size > 3 * 1024 * 1024) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('image', file);
    API.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(({ data }) => onUploaded(data.url))
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  return (
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy}
      onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
  );
}
const ForwardAvatarPicker = forwardRef(AvatarPicker);

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [pw, setPw] = useState(emptyPw);
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState(null); // { ok, text }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(() => searchParams.get('edit') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef(null);
  const menuWrapRef = useRef(null);

  // close the avatar menu when tapping anywhere else on the page
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuWrapRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  // if the viewport grows past 720px while the mobile path was used, reset
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 720px)');
    const reset = () => setMenuOpen(false);
    mq.addEventListener('change', reset);
    return () => mq.removeEventListener('change', reset);
  }, []);

  useEffect(() => {
    API.get('/profile').then(({ data }) => {
      setForm({ name: data.name || '', phone: data.phone || '', line: data.address?.line || '', ward: data.address?.ward || '' });
      setAvatarUrl(data.avatarUrl || '');
    }).catch(() => { });
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setErrors({}); setSaving(true);
    try {
      const { data } = await API.put('/profile', {
        name: form.name, phone: form.phone, address: { line: form.line, ward: form.ward },
      });
      updateUser({ name: data.name });
      setMsg('Profile saved');
      toast.success('Profile saved');
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setMsg(err.response?.data?.message || 'Save failed');
      toast.error('Could not save your profile');
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
      updateUser({ hasPassword: true });
      setPwMsg({ ok: true, text: 'Password updated' });
      toast.success('Password updated');
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Password change failed' });
      toast.error('Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link>.</p>;

  const removeAvatar = () => {
    setAvatarUrl('');
    updateUser({ avatarUrl: '' });
    API.put('/profile', { avatarUrl: '' }).catch(() => {});
    toast.success('Photo removed');
  };

  const avatarSrc = imageUrl(avatarUrl);

  const address = form.line || form.ward
    ? `${form.line || '—'}${form.ward ? `, Ward ${form.ward}` : ''}, Birgunj`
    : 'Not set yet';

  return (
    <div className="profile-page">
      {/* Hero — tapping the avatar opens the photo options first, on every
          screen size: Edit picture / Remove picture. The picker only fires
          from inside the menu, never directly from the tap. */}
      <header className="profile-hero card-panel">
        <div className="avatar-menu-wrap" ref={menuWrapRef}>
          <button type="button" className="avatar-trigger" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}>
            {avatarSrc
              ? <img src={avatarSrc} alt="" />
              : <span className="avatar-fallback" aria-hidden="true">{(user.name || '?').charAt(0).toUpperCase()}</span>}
            <span className="avatar-trigger-badge" aria-hidden="true"><Camera size={13} /></span>
          </button>
          {menuOpen && (
            <div className="avatar-menu" role="menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" role="menuitem" className="avatar-menu-item"
                onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>
                <Camera size={15} aria-hidden="true" /> Edit picture
              </button>
              {avatarUrl && (
                <button type="button" role="menuitem" className="avatar-menu-item is-danger"
                  onClick={() => { setMenuOpen(false); removeAvatar(); }}>
                  <Trash2 size={15} aria-hidden="true" /> Remove picture
                </button>
              )}
            </div>
          )}
          {/* the actual picker lives here, outside ImageUpload, so the menu controls it */}
          <ForwardAvatarPicker ref={fileRef} endpoint="/uploads/avatar" onUploaded={(url) => { setAvatarUrl(url); updateUser({ avatarUrl: url }); }} />
        </div>
        <div className="profile-hero-text">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
      </header>

      {/* Quick actions */}
      <nav className="profile-tiles" aria-label="Account shortcuts">
        <Link to="/orders" className="profile-tile">
          <Package size={20} aria-hidden="true" />
          <span>My orders</span>
        </Link>
        <Link to="/wishlist" className="profile-tile">
          <Heart size={20} aria-hidden="true" />
          <span>Wishlist</span>
        </Link>
      </nav>

      {/* Personal info */}
      <section className="card-panel">
        <div className="profile-section-head">
          <h2>Personal info</h2>
          {!editing && (
            <button type="button" className="profile-edit-btn" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
          )}
        </div>
        <form className={`form profile-form${editing ? ' is-editing' : ''}`} onSubmit={saveProfile}>
          {editing ? (
            <>
              <div className="field-row">
                <label>Full name
                  <input required value={form.name} onChange={set('name')} />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </label>
                <label>Phone
                  <input required inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </label>
              </div>
              <div className="field-row">
                <label>Street / tole
                  <input required value={form.line} onChange={set('line')} placeholder="e.g. Ghantaghar, Raniganj" />
                </label>
                <label>Ward No.
                  <input required value={form.ward} onChange={set('ward')} placeholder="e.g. 10" />
                </label>
              </div>
              {msg && <p className="save-msg"><CircleCheck size={14} aria-hidden="true" /> {msg}</p>}
              {Object.keys(errors).length > 0 && !msg && <p className="error"><TriangleAlert size={14} aria-hidden="true" /> Fix the highlighted fields</p>}
              <div className="profile-actions">
                <button type="submit" className="cta-btn" disabled={saving}>
                  <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="muted-btn" disabled={saving} onClick={() => { setEditing(false); setErrors({}); setMsg(''); }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <dl className="profile-details">
              <div><dt>Name</dt><dd>{form.name || '—'}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Phone</dt><dd>{form.phone || 'Not set'}</dd></div>
              <div><dt>Address</dt><dd>{address}</dd></div>
            </dl>
          )}
        </form>
      </section>

      {/* Security */}
      <section className="card-panel">
        <details className="pw-accordion pw-accordion--bare">
          <summary><KeyRound size={18} className="action-icon" aria-hidden="true" />{user.hasPassword ? 'Change password' : 'Set a password'}<ChevronDown size={16} className="pw-chev" aria-hidden="true" /></summary>
          <form className="form" onSubmit={changePw}>
            {!user.hasPassword && <p className="muted">This account uses Google sign-in. You can set a password for email sign-in here.</p>}
            {user.hasPassword && (
              <label>Current password
                <PasswordField value={pw.currentPassword} autoComplete="current-password"
                  onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </label>
            )}
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
        </details>
      </section>

      <button type="button" className="profile-logout-btn" onClick={signOut}>
        <LogOut size={18} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  );
}
