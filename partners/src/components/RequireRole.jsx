import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '@shared/context/AuthContext.jsx';
import { STOREFRONT_URL } from '@shared/lib/apps';


/** Route guard — keeps each workspace to the roles that belong in it. */
export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="gate">
        <span className="gate-icon"><ShieldX size={28} aria-hidden="true" /></span>
        <h1>This area is not for your account</h1>
        <p>
          You are signed in as <strong>{user.role}</strong>, and this workspace is for{' '}
          <strong>{roles.join(' / ')}</strong>.
        </p>
        <div className="gate-actions">
          {user.role === 'customer' ? (
            <a className="cta-btn" href={STOREFRONT_URL}>Go to the storefront</a>
          ) : (
            <Link className="cta-btn" to="/dashboard">Go to my dashboard</Link>
          )}
        </div>
        <p className="gate-hint">
          {user.role === 'customer'
            ? 'Shopping, orders and your profile all live on the storefront.'
            : 'Your own workspace is one click away.'}
        </p>
      </div>
    );
  }
  return children;
}
