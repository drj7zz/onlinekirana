import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import API from '@shared/api';
import useSeo from '@shared/hooks/useSeo';

export default function VerifyEmail() {
  useSeo({
    title: 'Partner Application Code — OnlineKirana',
    description: 'Enter the in-app code for your OnlineKirana merchant or delivery partner application.',
    noindex: true,
  });
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [email, setEmail] = useState(searchParams.get('email') || location.state?.email || '');
  const [code, setCode] = useState('');
  const [shownCode, setShownCode] = useState(location.state?.verificationCode || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendOpen, setResendOpen] = useState(!location.state?.verificationCode);

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await API.post('/auth/verify-email', { email, code });
      setMessage(data.message);
      setVerified(true);
      setShownCode('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The code could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await API.post('/auth/resend-verification', { email, password });
      setShownCode(data.verificationCode);
      setCode('');
      setMessage(data.message);
      setPassword('');
      setResendOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'A new code could not be issued.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="form narrow">
      <h1>Enter your application code</h1>
      <p className="muted">
        This temporary in-app code step does not verify that you own the email address. Use a valid address;
        This is not email verification. Restoring email ownership checks will require a verified sender and an email-delivered code.
      </p>
      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {shownCode && !verified && (
        <p className="save-msg" role="status">
          Your one-time code: <strong>{shownCode}</strong> · Expires in 15 minutes.
        </p>
      )}
      {!verified && (
        <>
          <form onSubmit={verify}>
            <label>
              Application email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Six-digit code
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="submit" className="cta-btn" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Confirm code'}
            </button>
          </form>
          <p className="muted">
            Didn’t save the code? <button type="button" className="muted-btn" onClick={() => setResendOpen((open) => !open)}>Get a new code</button>
          </p>
          {resendOpen && (
            <form onSubmit={resend}>
              <label>
                Application password
                <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button type="submit" className="muted-btn" disabled={busy}>
                {busy ? 'Issuing…' : 'Issue new code'}
              </button>
            </form>
          )}
        </>
      )}
      {verified && <p><Link to="/login">Continue to sign in</Link></p>}
    </section>
  );
}
