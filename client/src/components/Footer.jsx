import { Link } from 'react-router-dom';
import {
  ShoppingCart, MapPin, Phone, Mail, Clock,
  Globe, MessageCircle, Share2, Send, Truck, ShieldCheck, Headset,
} from 'lucide-react';

const HELP_LINKS = [
  { label: 'How to order', to: '/faq#order' },
  { label: 'Delivery & charges', to: '/faq#delivery' },
  { label: 'Payment options', to: '/faq#payment' },
  { label: 'Returns & refunds', to: '/faq#returns' },
  { label: 'Track your order', to: '/orders' },
];

const COMPANY_LINKS = [
  { label: 'About OnlineKirana', to: '/about' },
  { label: 'Become a partner', to: '/register?partner=1' },
  { label: 'Seller dashboard', to: '/partners' },
  { label: 'Careers', to: '/about#careers' },
  { label: 'Contact us', to: '/contact' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      {/* value strip */}
      <div className="footer-strip">
        <div className="footer-strip-inner">
          <div className="footer-strip-item"><Truck size={20} aria-hidden="true" /><span><strong>Fast delivery</strong>Across Birgunj</span></div>
          <div className="footer-strip-item"><ShieldCheck size={20} aria-hidden="true" /><span><strong>Fresh &amp; genuine</strong>Sourced locally</span></div>
          <div className="footer-strip-item"><Headset size={20} aria-hidden="true" /><span><strong>Support 7 days</strong>9:00 AM – 9:00 PM</span></div>
        </div>
      </div>

      <div className="footer-main">
        {/* brand + contact */}
        <div className="footer-col footer-brand">
          <Link to="/" className="footer-logo">
            <span className="footer-logo-mark"><ShoppingCart size={18} strokeWidth={2.4} aria-hidden="true" /></span>
            <span>Online<span className="footer-accent">Kirana</span></span>
          </Link>
          <p className="footer-about">
            Birgunj&apos;s online pasal — fresh sabzi, phalphul, chamal and daily essentials
            delivered to your door from trusted local shops.
          </p>
          <ul className="footer-contact">
            <li><MapPin size={15} aria-hidden="true" /><span>Adarsh Nagar, Ward 12, Birgunj, Parsa, Nepal</span></li>
            <li><Phone size={15} aria-hidden="true" /><a href="tel:+9779800000000">+977 98-0000-0000</a></li>
            <li><Mail size={15} aria-hidden="true" /><a href="mailto:support@onlinekirana.com">support@onlinekirana.com</a></li>
            <li><Clock size={15} aria-hidden="true" /><span>Sun – Sat, 9:00 AM – 9:00 PM</span></li>
          </ul>
          <div className="footer-social">
            <a href="https://facebook.com" aria-label="Facebook" target="_blank" rel="noreferrer"><Globe size={16} aria-hidden="true" /></a>
            <a href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /></a>
            <a href="https://twitter.com" aria-label="Twitter" target="_blank" rel="noreferrer"><Share2 size={16} aria-hidden="true" /></a>
          </div>
        </div>

        {/* quick links */}
        <div className="footer-col">
          <h3>Shop</h3>
          <ul className="footer-links">
            <li><Link to="/">All groceries</Link></li>
            <li><Link to="/?category=food">Food &amp; staples</Link></li>
            <li><Link to="/cart">Your cart</Link></li>
            <li><Link to="/orders">My orders</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Help</h3>
          <ul className="footer-links">
            {HELP_LINKS.map((l) => <li key={l.label}><Link to={l.to}>{l.label}</Link></li>)}
          </ul>
        </div>

        <div className="footer-col">
          <h3>Company</h3>
          <ul className="footer-links">
            {COMPANY_LINKS.map((l) => <li key={l.label}><Link to={l.to}>{l.label}</Link></li>)}
          </ul>
        </div>

        {/* newsletter */}
        <div className="footer-col footer-news">
          <h3>Stay in the loop</h3>
          <p className="footer-about">Offers, seasonal sabzi and new shops — straight to your inbox.</p>
          <form className="footer-news-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="you@example.com" aria-label="Email address" required />
            <button type="submit" aria-label="Subscribe"><Send size={15} aria-hidden="true" /></button>
          </form>
        </div>
      </div>

      {/* bottom bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p>© {year} OnlineKirana. All rights reserved.</p>
          <ul className="footer-legal">
            <li><Link to="/about#terms">Terms of Service</Link></li>
            <li><Link to="/about#privacy">Privacy Policy</Link></li>
            <li><Link to="/about#refund">Refund Policy</Link></li>
          </ul>
          <p className="footer-made">Made in Birgunj, Nepal 🇳🇵</p>
        </div>
      </div>
    </footer>
  );
}