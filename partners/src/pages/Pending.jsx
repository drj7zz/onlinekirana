import { Link } from 'react-router-dom';
import { Clock, Store, Bike } from 'lucide-react';
import { useAuth } from '@shared/context/AuthContext';
import useSeo from '@shared/hooks/useSeo';

/**
 * Shown right after signing up, and reachable later from the nav. A new partner
 * has an account but cannot work yet — this says so plainly instead of leaving
 * them on an empty dashboard wondering what they did wrong.
 */
export default function Pending() {
  useSeo({ title: 'Application Pending — OnlineKirana', description: 'Your OnlineKirana partner application is awaiting review.', noindex: true });
  const { user } = useAuth();
  const isRider = user?. role === 'delivery';
  const icon = isRider ? <Bike size={32} aria-hidden="true" /> : <Store size={32} aria-hidden="true" />;

  if (!user) {
    return <p className="empty">Please <Link to="/login">sign in</Link> to see your application.</p>;
  }

  return (
    <div className="gate">
      <span className="gate-icon"><Clock size={28} aria-hidden="true" /></span>
      <h1>Your application is with us</h1>
      <p>
        Thanks {user. name} — your {isRider ? 'rider' : 'shop'} account is created and waiting for
        a quick review by the operations desk. This is usually the same day.
      </p>

      <div className="card-panel" style={{ textAlign: 'left', margin: '1.4rem 0', background: '#f7f9f7' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '1rem' }}>
          {icon} What happens next
        </h2>
        <ol className="info-steps" style={{ margin: '.5rem 0 0', paddingLeft: '1.1rem', color: '#444', fontSize: '.88rem' }}>
          <li>An admin approves your account from the delivery desk.</li>
          {isRider ? (
            <>
              <li>You sign back in and tap <strong>Go on shift</strong> on your shift page.</li>
              <li>Open jobs start appearing for you to take.</li>
            </>
          ) : (
            <>
              <li>You sign back in and set up your public shop page.</li>
              <li>List your products — each one is approved before it goes live.</li>
            </>
          )}
        </ol>
      </div>

      <div className="gate-actions">
        <Link className="cta-btn" to={isRider ? '/rider' : '/dashboard'}>
          Go to my workspace
        </Link>
        <Link className="gate-link" to="/">Back to the portal home</Link>
      </div>

      <p className="gate-hint">
        You do not need to upload any documents, and there is nothing else to fill in.
      </p>
    </div>
  );
}
