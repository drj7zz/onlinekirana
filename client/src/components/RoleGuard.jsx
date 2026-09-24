import AccessDenied from './AccessDenied';
import { useAuth } from '../context/AuthContext';

/**
 * Guards a page for one role.
 *  - not signed in          → friendly sign-in gate
 *  - signed in, wrong role  → friendly "not available" gate with a route back
 *  - correct role           → renders the page (its own content loads once allowed)
 * No internal identifiers, endpoints or error text are ever shown to the visitor.
 */
export default function RoleGuard({ role, children }) {
  const { user } = useAuth();

  if (!user) return <AccessDenied role={role} />;
  if (role && user.role !== role) return <AccessDenied role={role} />;

  return children;
}
