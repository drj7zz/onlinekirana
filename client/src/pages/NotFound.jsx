import { Link } from 'react-router-dom';
import { Compass, ArrowRight, Home, ShoppingCart } from 'lucide-react';

// Friendly 404 — no route names, stack traces or developer wording.
export default function NotFound() {
  return (
    <div className="gate">
      <span className="gate-icon"><Compass size={26} aria-hidden="true" /></span>
      <h1>Page not found</h1>
      <p className="muted">
        The page you were looking for doesn&apos;t exist or may have been moved.
        Let&apos;s get you back on track.
      </p>
      <div className="gate-actions">
        <Link to="/" className="cta-btn">
          <Home size={16} aria-hidden="true" /> Back to shopfront
        </Link>
        <Link to="/cart" className="gate-link">
          <ShoppingCart size={15} aria-hidden="true" /> View your cart
        </Link>
      </div>
    </div>
  );
}