import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '@shared/api';
import useSeo from '@shared/hooks/useSeo';

export default function VerifyEmail() {
  useSeo({
    title: 'Verify Partner Email — OnlineKirana',
    description: 'Verify the email address for your OnlineKirana merchant or delivery partner application.',
    noindex: true,
  });
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const verificationStarted = useRef(false);

  useEffect(() => {
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;
    let active = true;
    API.post('/auth/verify-email', { token })
      .then(({ data }) => { if (active) { setMessage(data.message); setVerified(true); } })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'This verification link could not be used.'); });
    return () => { active = false; };
  }, [token]);

  const resend = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await API.post('/auth/resend-verification', { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'The verification email could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form narrow">
      <h1>Verify your email</h1>
      {message && <p role="status">{message}</p>}
      {!token && !message && <p className="muted">Enter the email address used for your merchant or delivery partner application. We will send a fresh verification link if it is still pending.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!verified && (
        <form onSubmit={resend}>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button type="submit" className="cta-btn" disabled={busy}>
            {busy ? 'Sending…' : 'Resend verification email'}
          </button>
        </form>
      )}
      {verified && <p><Link to="/login">Continue to sign in</Link></p>}
    </section>
  );
}
