import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CircleCheck, CircleX, RefreshCw } from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';

const LABELS = {
  email: 'Resend email delivery',
  cloudinary: 'Cloudinary image storage',
  redis: 'Redis rate limits and background jobs',
};

const STATUS = {
  ok: 'Connected',
  not_configured: 'Not configured',
  sender_domain_not_verified: 'Sender domain not verified',
  error: 'Connection failed',
};

export default function AdminIntegrations() {
  const { user } = useAuth();
  const [checks, setChecks] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await API.get('/admin/integrations');
      setChecks(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Integration checks could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  if (user?.role !== 'admin') return <p className="empty">Admin access only.</p>;

  return (
    <section>
      <h1>Integration health</h1>
      <p className="muted">Checks provider connectivity without revealing API keys or sending a test email.</p>
      <button type="button" className="cta-btn" onClick={check} disabled={busy}>
        <RefreshCw size={15} aria-hidden="true" /> {busy ? 'Checking…' : 'Check integrations'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      {checks && <div className="profile-rows" style={{ marginTop: '1rem' }}>
        {Object.entries(LABELS).map(([key, label]) => {
          const status = checks[key]?.status || 'error';
          const healthy = status === 'ok';
          return (
            <div className="profile-row" key={key}>
              <div className="profile-row-head">
                {healthy
                  ? <CircleCheck size={17} color="var(--success)" aria-hidden="true" />
                  : <CircleX size={17} color="var(--danger-strong)" aria-hidden="true" />}
                <span className="profile-row-title"><strong>{label}</strong><small>{STATUS[status] || status}</small></span>
              </div>
            </div>
          );
        })}
      </div>}
      {!checks && !error && <p className="muted" style={{ marginTop: '1rem' }}><Activity size={14} aria-hidden="true" /> Run a check to see provider status.</p>}
      <p className="muted" style={{ marginTop: '1rem' }}>Configure email credentials in the API host settings. Never put provider keys in frontend environment variables.</p>
      <Link to="/dashboard">Back to dashboard</Link>
    </section>
  );
}
