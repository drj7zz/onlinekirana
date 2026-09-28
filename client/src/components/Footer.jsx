import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Truck, ShieldCheck, Store, MapPin, Phone } from 'lucide-react';
import API from '../api';
import { PORTAL_URL } from '../lib/apps';

/**
 * Site footer, in the same format as the partner portal's: a dark
 * `.site-footer` with a three-up value strip, the main link columns, and the
 * bottom legal bar. The Categories column is fetched live from the API — no
 * hardcoded list to drift out of sync with the database.
 *
 * The grid is pinned to the same 1180px max-width and 1.25rem gutter as the
 * navbar and `.container`, so the brand, the first product card and the first
 * footer column all start on one vertical line.
 */
const USEFUL_LINKS = [
  { label: 'About Us', to: '/about' },
  { label: 'FAQs', to: '/faq' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'Terms of Service', to: '/about#terms' },
  { label: 'Privacy Policy', to: '/about#privacy' },
  { label: 'Refund Policy', to: '/about#refund' },
  { label: 'Careers', to: '/about#careers' },
];

const RESOURCES = [
  { label: 'My Orders', to: '/orders' },
  { label: 'My Cart', to: '/cart' },
  { label: 'My Account', to: '/profile' },
];

const SHOWN = 9;

export default function Footer() {
  const [cats, setCats] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let live = true;
    API.get('/products/categories')
      .then((res) => { if (live) setCats(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { /* footer survives without categories */ });
    return () => { live = false; };
  }, []);

  const year = new Date().getFullYear();
  const visible = expanded ? cats : cats.slice(0, SHOWN);

  return (
    <footer className="site-footer">
      {/* value strip */}
      <div className="footer-strip">
        <div className="footer-strip-inner">
          <div className="footer-strip-item"><Truck size={20} aria-hidden="true" /><span><strong>30-minute delivery</strong>Across every ward in Birgunj</span></div>
          <div className="footer-strip-item"><ShieldCheck size={20} aria-hidden="true" /><span><strong>Cash on delivery</strong>Or pay with eSewa</span></div>
          <div className="footer-strip-item"><Store size={20} aria-hidden="true" /><span><strong>Local shops</strong>Every order supports a shopkeeper</span></div>
        </div>
      </div>

      {/* main columns */}
      <div className="footer-main">
        <div className="footer-col footer-brand">
          <Link to="/" className="footer-logo">
            <img src="/logo.png" alt="OnlineKirana" /> <span className="footer-logo-word">online<span className="footer-accent">kirana</span></span>
          </Link>
          <p className="footer-about">
            Groceries from local Birgunj shops, delivered to your ward in 30 minutes. Cash on
            delivery, or pay with eSewa.
          </p>
          <ul className="footer-contact">
            <li><MapPin size={15} aria-hidden="true" /><span>Serving every ward, Birgunj, Nepal</span></li>
            <li><Phone size={15} aria-hidden="true" /><span>Support: 9800000000</span></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Shop</h3>
          <ul className="footer-links">
            {RESOURCES.map((l) => (
              <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
            ))}
            <li><Link to="/register">Create an account</Link></li>
            <li><Link to="/login">Sign in</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Useful Links</h3>
          <ul className="footer-links">
            {USEFUL_LINKS.map((l) => (
              <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <h3>Categories</h3>
          {cats.length === 0 ? (
            <p className="footer-about">Loading…</p>
          ) : (
            <>
              <ul className="footer-links">
                {visible.map((c) => (
                  <li key={c}><Link to={`/?category=${encodeURIComponent(c)}`}>{c}</Link></li>
                ))}
              </ul>
              {cats.length > SHOWN && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="footer-see-all"
                  aria-expanded={expanded}
                >
                  {expanded ? 'see less' : 'see all'}
                  <ChevronDown size={14} className={expanded ? 'is-open' : ''} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>

        <div className="footer-col">
          <h3>Partners</h3>
          <ul className="footer-links">
            <li><a href={`${PORTAL_URL}/join`} target="_blank" rel="noreferrer">Partner with us ↗</a></li>
            <li><a href={PORTAL_URL} target="_blank" rel="noreferrer">Seller dashboard ↗</a></li>
            <li><a href={`${PORTAL_URL}/register`} target="_blank" rel="noreferrer">Deliver with us ↗</a></li>
            <li><a href={`${PORTAL_URL}/faq`} target="_blank" rel="noreferrer">Partner FAQ ↗</a></li>
          </ul>
        </div>
      </div>

      {/* bottom bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span className="footer-made">© {year} OnlineKirana — Birgunj, Nepal. All rights reserved.</span>
          <ul className="footer-legal">
            <li><Link to="/about#privacy">Privacy</Link></li>
            <li><Link to="/about#terms">Terms</Link></li>
            <li><Link to="/about#refund">Refunds</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

