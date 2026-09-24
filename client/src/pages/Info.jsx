import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Info as InfoIcon, Mail, Phone, MapPin, Clock, ChevronDown,
  Store, Truck, ShieldCheck, Send, CheckCircle2, FileText,
} from 'lucide-react';

const FAQS = [
  { id: 'order', q: 'How do I place an order?', a: 'Browse or search for groceries on the shopfront, add items to your cart, then go to checkout. Confirm your Birgunj delivery address and place the order. You can browse without an account, but you must log in to check out.' },
  { id: 'delivery', q: 'Where do you deliver and what does it cost?', a: 'We deliver across Birgunj Sub-Metropolitan City. Delivery is free above रू 1,000; a flat रू 50 applies below that. Orders placed before 6:00 PM qualify for same-day delivery.' },
  { id: 'payment', q: 'What payment methods do you accept?', a: 'Cash on Delivery (COD) is available across Birgunj, and you can also pay digitally via eSewa. Pick your method at checkout.' },
  { id: 'returns', q: 'What is the return and refund policy?', a: 'Fresh produce can be returned at the doorstep if it does not meet expectations. For packaged items, report any issue within 24 hours of delivery for a replacement or refund.' },
  { id: 'partner', q: 'How do I sell on OnlineKirana?', a: 'Register as a partner, complete your shop profile, and submit it for review. Once an admin approves your shop, you can list products and receive orders directly.' },
];

export default function Info({ page = 'about' }) {
  const { hash } = useLocation();
  const [open, setOpen] = useState(0);

  // jump to the right anchor when arriving from a deep link
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [hash, page]);

  if (page === 'faq') {
    return (
      <div className="info-page">
        <header className="info-head">
          <InfoIcon size={26} aria-hidden="true" />
          <h1>Help &amp; FAQ</h1>
          <p className="muted">Everything you need to know about ordering, delivery and payments.</p>
        </header>
        <div className="info-faq">
          {FAQS.map((f, i) => (
            <div key={f.id} id={f.id} className={`faq-item${open === i ? ' open' : ''}`}>
              <button type="button" className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {f.q}<ChevronDown size={17} aria-hidden="true" />
              </button>
              {open === i && <p className="faq-a">{f.a}</p>}
            </div>
          ))}
        </div>
        <p className="info-cta">Still need help? <Link to="/contact" className="shop-link">Contact support →</Link></p>
      </div>
    );
  }

  if (page === 'contact') {
    return (
      <div className="info-page">
        <header className="info-head">
          <Mail size={26} aria-hidden="true" />
          <h1>Contact us</h1>
          <p className="muted">We&apos;re here to help, 7 days a week.</p>
        </header>

        <div className="info-grid">
          <a className="info-card" href="tel:+9779800000000">
            <Phone size={20} aria-hidden="true" />
            <strong>Call us</strong>
            <span className="muted">+977 98-0000-0000</span>
          </a>
          <a className="info-card" href="mailto:support@onlinekirana.com">
            <Mail size={20} aria-hidden="true" />
            <strong>Email us</strong>
            <span className="muted">support@onlinekirana.com</span>
          </a>
          <div className="info-card">
            <MapPin size={20} aria-hidden="true" />
            <strong>Visit us</strong>
            <span className="muted">Adarsh Nagar, Ward 12, Birgunj, Parsa</span>
          </div>
          <div className="info-card">
            <Clock size={20} aria-hidden="true" />
            <strong>Support hours</strong>
            <span className="muted">Sun – Sat, 9:00 AM – 9:00 PM</span>
          </div>
        </div>

        <form className="info-form" onSubmit={(e) => { e.preventDefault(); e.currentTarget.reset(); alert('Thanks! Our team will get back to you shortly.'); }}>
          <h2>Send us a message</h2>
          <div className="info-form-row">
            <label>Your name<input type="text" required placeholder="Full name" /></label>
            <label>Email<input type="email" required placeholder="you@example.com" /></label>
          </div>
          <label>Subject<input type="text" required placeholder="How can we help?" /></label>
          <label>Message<textarea rows="4" required placeholder="Tell us more…" /></label>
          <button type="submit" className="cta-btn"><Send size={16} aria-hidden="true" /> Send message</button>
        </form>
      </div>
    );
  }

  // default: about
  return (
    <div className="info-page">
      <header className="info-head">
        <Store size={26} aria-hidden="true" />
        <h1>About OnlineKirana</h1>
        <p className="muted">The online pasal bringing Birgunj&apos;s local shops to your doorstep.</p>
      </header>

      <div className="info-grid">
        <div className="info-card"><Truck size={20} aria-hidden="true" /><strong>Fast local delivery</strong><span className="muted">Same-day across Birgunj</span></div>
        <div className="info-card"><ShieldCheck size={20} aria-hidden="true" /><strong>Trusted shops</strong><span className="muted">Verified partner sellers</span></div>
        <div className="info-card"><CheckCircle2 size={20} aria-hidden="true" /><strong>Fresh everyday</strong><span className="muted">Sourced from the local bazaar</span></div>
      </div>

      <section id="terms" className="info-block">
        <h2><FileText size={17} aria-hidden="true" /> Terms of Service</h2>
        <p>By using OnlineKirana you agree to provide accurate delivery details, review product listings and prices before ordering, and use the platform lawfully. Orders are fulfilled by partner shops and are subject to product availability.</p>
      </section>
      <section id="privacy" className="info-block">
        <h2><ShieldCheck size={17} aria-hidden="true" /> Privacy Policy</h2>
        <p>We collect only the information needed to process your orders and deliver them — your name, contact number and delivery address. We never sell your personal data. Uploaded images and account details are stored securely and used solely to operate the service.</p>
      </section>
      <section id="refund" className="info-block">
        <h2><CheckCircle2 size={17} aria-hidden="true" /> Refund Policy</h2>
        <p>If an item is missing, damaged or not as described, report it within 24 hours of delivery. We will arrange a replacement or a refund to your original payment method. Fresh produce can be returned at the doorstep.</p>
      </section>
      <section id="careers" className="info-block">
        <h2><Store size={17} aria-hidden="true" /> Careers</h2>
        <p>We&apos;re a growing team in Birgunj. Interested in delivery, operations or engineering? Reach out at <a className="shop-link" href="mailto:support@onlinekirana.com">support@onlinekirana.com</a>.</p>
      </section>
    </div>
  );
}