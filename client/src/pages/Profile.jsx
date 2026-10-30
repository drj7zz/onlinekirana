import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UserCircle, Save, KeyRound, CircleCheck, TriangleAlert, Package, Lock, Pencil } from 'lucide-react';
import API from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PasswordField, StrengthMeter, checkPassword } from '../components/PasswordSecurity';
import ImageUpload from '../components/ImageUpload';

const emptyForm = { name: '', phone: '', line: '', ward: '' };
const emptyPw = { currentPassword: '', newPassword: '', confirm: '' };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [pw, setPw] = useState(emptyPw);
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState(null); // { ok, text }
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  // saved-view first; "Edit profile" (or ?edit=1 from the dashboard) opens the form.
  // Lazy initialiser rather than an effect setState — no cascading render.
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(() => searchParams.get('edit') === '1');

  // load the full profile (including saved default address) on mount
  useEffect(() => {
    API.get('/profile').then(({ data }) => {
      setForm({ name: data.name || '', phone: data.phone || '', line: data.address?.line || '', ward: data.address?.ward || '' });
      setAvatarUrl(data.avatarUrl || '');
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setErrors({}); setSaving(true);
    try {
      const { data } = await API.put('/profile', {
        name: form.name, phone: form.phone, address: { line: form.line, ward: form.ward },
      });
      updateUser({ name: data.name }); // keep the navbar in sync
      setMsg('Profile saved. This address is now your default for orders.');
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
      setPwMsg({ ok: true, text: 'Password updated' });
      toast.success('Password updated');
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Password change failed' });
      toast.error('Password change failed');
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) return <p className="empty">Please <Link to="/login">login</Link>.</p>;

  const details = [
    ['Email', user.email],
    ['Role', user.role === 'customer' ? 'Shopper' : user.role],
    ['Phone', form.phone || 'Not set yet'],
    ['Default address', form.line || form.ward ? `${form.line || '—'}${form.ward ? `, Ward ${form.ward}` : ''}, Birgunj` : 'Not set yet'],
  ];

  return (
    <div className="profile-page">
      <div className="profile-head">
        <ImageUpload endpoint="/uploads/avatar" value={avatarUrl} round size={88}
          label="Upload photo" onChange={(url) => { setAvatarUrl(url); updateUser({ avatarUrl: url }); }} />
        <div>
          <h1>{user.name}</h1>
          <p className="muted">{user.email}</p>
        </div>
      </div>

      <Link to="/orders" className="card-panel profile-orders-link">
        <Package size={19} className="action-icon" aria-hidden="true" />
        <strong>My orders</strong>
        <span className="muted">Track deliveries, view receipts and reorder — go to my orders →</span>
      </Link>

      <section className="card-panel">
        <h2><UserCircle size={19} className="action-icon" aria-hidden="true" />Personal info & default address</h2>
        <p className="muted">Orders at checkout use this address and phone automatically.</p>
        <form className={`form profile-form${editing ? ' is-editing' : ''}`} onSubmit={saveProfile}>
          {editing ? (
            <>
              {/* paired fields share a row in edit mode to keep the form
                  compact; the `.field-row` CSS stacks them on narrow screens. */}
              <div className="field-row">
                <label>Full name
                  <input required value={form.name} onChange={set('name')} />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </label>
                <label>Phone (default for orders)
                  <input required inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" />
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </label>
              </div>
              <div className="field-row">
                <label>Address — street / tole (default for orders)
                  <input required value={form.line} onChange={set('line')} placeholder="e.g. Ghantaghar, Raniganj" />
                </label>
                <label>Ward No. (Birgunj)
                  <input required value={form.ward} onChange={set('ward')} placeholder="e.g. 10" />
                </label>
              </div>
            </>
          ) : (
            <dl className="profile-details">
              {details.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
          {editing && msg && <p className="save-msg"><CircleCheck size={14} aria-hidden="true" /> {msg}</p>}
          {editing && Object.keys(errors).length > 0 && !msg && <p className="error"><TriangleAlert size={14} aria-hidden="true" /> Fix the highlighted fields</p>}
          {editing ? (
            <div className="profile-actions">
              <button type="submit" className="cta-btn" disabled={saving}>
                <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save profile'}
              </button>
              <button type="button" className="muted-btn" disabled={saving} onClick={() => { setEditing(false); setErrors({}); setMsg(''); }}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="cta-btn" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" /> Edit profile
            </button>
          )}
        </form>
        {!editing && <p className="muted" style={{ marginTop: '.5rem' }}><Lock size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Orders at checkout use this address and phone automatically.</p>}
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
