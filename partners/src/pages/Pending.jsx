import { Link } from 'react-router-dom';
import { Clock, Store, Bike, Ban } from 'lucide-react';
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
  const isRider = user?.role === 'delivery';
  const isSuspended = isRider ? user?.riderStatus === 'suspended' : user?.merchantStatus === 'suspended';
  const icon = isRider ? <Bike size={32} aria-hidden="true" /> : <Store size={32} aria-hidden="true" />;

  if (!user) {
    return <p className="empty">Please <Link to="/login">sign in</Link> to see your application.</p>;
  }

  return (
    <div className="gate">
      <span className="gate-icon">{isSuspended ? <Ban size={28} aria-hidden="true" /> : <Clock size={28} aria-hidden="true" />}</span>
      <h1>{isSuspended ? 'Your account is paused' : 'Your application is with us'}</h1>
      <p>
        {isSuspended
          ? `The operations team paused access to this ${isRider ? 'rider' : 'shop'} account. Contact them for help.`
          : `Thanks ${user.name} — your ${isRider ? 'rider' : 'shop'} account is waiting for review. The team usually reviews applications the same day.`}
      </p>

      {!isSuspended && <div className="card-panel" style={{ textAlign: 'left', margin: '1.4rem 0', background: '#f7f9f7' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '1rem' }}>
          {icon} What happens next
        </h2>
        <ol className="info-steps" style={{ margin: '.5rem 0 0', paddingLeft: '1.1rem', color: '#444', fontSize: '.88rem' }}>
          <li>An admin reviews your application in the Approvals section.</li>
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
      </div>}

      <div className="gate-actions">
        {!isSuspended && <Link className="cta-btn" to={isRider ? '/rider' : '/dashboard'}>Go to my workspace</Link>}
        <Link className="gate-link" to="/">Back to the portal home</Link>
      </div>

      {!isSuspended && <p className="gate-hint">You do not need to upload any documents, and there is nothing else to fill in.</p>}
    </div>
  );
}
