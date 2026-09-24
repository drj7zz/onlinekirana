import { Link } from 'react-router-dom';
import { Lock, ArrowRight, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Friendly, non-technical gate shown when a page isn't available to the visitor.
 * Two cases:
 *  - visitor not signed in     → invite them to sign in
 *  - signed in but wrong role  → explain in plain words, offer where to go next
 * Never renders internal role names, IDs, endpoints or stack details.
 */
const ROLE_CONTEXT = {
  admin: {
    title: 'Staff area',
    body: 'This area is for OnlineKirana staff. Your account can shop, track orders and manage your profile.',
  },
  merchant: {
    title: 'Partner area',
    body: 'This area is for registered shop partners. You can keep shopping or apply to become a partner.',
  },
  customer: {
    title: 'Customer area',
    body: 'This area is for customer accounts. Head to your dashboard to manage your account.',
  },
};

export default function AccessDenied({ role }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="gate">
        <span className="gate-icon"><Lock size={26} aria-hidden="true" /></span>
        <h1>Please sign in</h1>
        <p className="muted">
          You need an account to view this page. Sign in to continue, or create a free
          account in a minute.
        </p>
        <div className="gate-actions">
          <Link to="/login" className="cta-btn">
            Sign in <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
          </Link>
          <Link to="/register" className="gate-link">Create an account</Link>
        </div>
        {role === 'merchant' && (
          <p className="gate-hint">
            Want to sell on OnlineKirana? <Link to="/register?partner=1" className="shop-link">Apply as a partner</Link>.
          </p>
        )}
      </div>
    );
  }

  const ctx = ROLE_CONTEXT[role] || { title: 'Unavailable', body: 'This page is not available for your account.' };

  return (
    <div className="gate">
      <span className="gate-icon"><Lock size={26} aria-hidden="true" /></span>
      <h1>{ctx.title}</h1>
      <p className="muted">{ctx.body}</p>
      <div className="gate-actions">
        <Link to="/dashboard" className="cta-btn">
          Go to my dashboard <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
        </Link>
        <Link to="/" className="gate-link">
          <Home size={15} aria-hidden="true" /> Back to shopfront
        </Link>
      </div>
    </div>
  );
}