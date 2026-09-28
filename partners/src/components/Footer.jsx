import { Link } from 'react-router-dom';
import { Store, Bike, ShieldCheck, MapPin, Phone } from 'lucide-react';
import { STOREFRONT_URL } from '@shared/lib/apps';

/**
 * Site footer.
 *
 * Same structure as the storefront's footer — a three-up value strip, the main
 * link columns on the shared 1180px grid, and the bottom legal bar — so the two
 * apps close the page identically. The portal renders inside `.app-shell`, which
 * is what selects the light theme; the dark rules in the shared stylesheet are
 * the unscoped fallback and never apply here.
 *
 * The link set is the business side of the marketplace rather than the shopping
 * side: how to join and register a shop instead of cart and checkout, and the
 * storefront is reached over its own origin.
 */

const GET_STARTED = [
  { label: 'Register a shop', to: '/register' },
  { label: 'How to join', to: '/join' },
  { label: 'Partner FAQ', to: '/faq' },
  { label: 'Sign in', to: '/login' },
];

const SHOPPING = [
  { label: 'Shop groceries', href: STOREFRONT_URL },
  { label: 'About us', href: `${STOREFRONT_URL}/about` },
  { label: 'Contact', href: `${STOREFRONT_URL}/contact` },
  { label: 'Refunds & returns', href: `${STOREFRONT_URL}/about#refund` },
];

const LEGAL = [
  { label: 'Privacy', href: `${STOREFRONT_URL}/about#privacy` },
  { label: 'Terms', href: `${STOREFRONT_URL}/about#terms` },
  { label: 'Contact', href: `${STOREFRONT_URL}/contact` },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-strip">
        <div className="footer-strip-inner">
          <div className="footer-strip-item"><Store size={20} aria-hidden="true" /><span><strong>Sell on OnlineKirana</strong>Reach every ward in Birgunj</span></div>
          <div className="footer-strip-item"><Bike size={20} aria-hidden="true" /><span><strong>Flexible shifts</strong>Work when you want</span></div>
          <div className="footer-strip-item"><ShieldCheck size={20} aria-hidden="true" /><span><strong>No documents</strong>Just email and phone</span></div>
        </div>
      </div>

      <div className="footer-main" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
        <div className="footer-col footer-brand">
          <Link to="/" className="footer-logo">
            <img src="/logo.png" alt="OnlineKirana" /> <span className="footer-logo-word">online<span className="footer-accent">kirana</span></span>
          </Link>
          <p className="footer-about">
            The business side of OnlineKirana — where shopkeepers list their products, riders run
            their shifts, and the operations desk keeps the marketplace healthy.
          </p>
          <ul className="footer-contact">
            <li><MapPin size={15} aria-hidden="true" /><span>Serving every ward, Birgunj, Nepal</span></li>
            <li><Phone size={15} aria-hidden="true" /><span>Support: 9800000000</span></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Get started</h3>
          <ul className="footer-links">
            {GET_STARTED.map((l) => (
              <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <h3>Shopping</h3>
          <ul className="footer-links">
            {SHOPPING.map((l) => (
              <li key={l.label}><a href={l.href} target="_blank" rel="noreferrer">{l.label} ↗</a></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span className="footer-made">© {year} OnlineKirana Partners — Birgunj, Nepal. All rights reserved.</span>
          <ul className="footer-legal">
            {LEGAL.map((l) => (
              <li key={l.label}><a href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
