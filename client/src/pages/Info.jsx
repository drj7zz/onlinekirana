
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Info as InfoIcon, Mail, Phone, MapPin, Clock, ChevronDown,
  Store, Truck, ShieldCheck, Send, CheckCircle2, FileText,
  ShoppingCart, Wallet, RotateCcw, UserCircle2,
} from 'lucide-react';

const CATEGORIES = [
  {
    name: 'Ordering',
    icon: ShoppingCart,
    faqs: [
      {
        id: 'order',
        q: 'How do I place an order?',
        a: [
          'Browse or search the shopfront, open a product, choose your quantity and press “Add to cart”. Your cart keeps everything in one place — you can adjust quantities or remove items at any time.',
          'When you are ready, press “Go to checkout”. Confirm your Birgunj delivery address and phone number, pick a payment method and place the order. You can browse without an account, but you must log in to check out.',
        ],
      },
      {
        id: 'change-order',
        q: 'Can I change or cancel my order after placing it?',
        a: [
          'Yes — as long as the order has not been packed for delivery. Open My orders, find the order and press “Cancel” while it is still pending.',
          'Once a shop has packed your order (status “packed” or beyond) it can no longer be cancelled online, but you can still refuse fresh produce at the doorstep.',
        ],
      },
      {
        id: 'stock',
        q: 'What if an item goes out of stock after I order?',
        a: [
          'Shops confirm your order against real stock before packing. If something is unavailable, that item is refunded automatically and the rest of your order is delivered — you are never left waiting for the whole order because of one item.',
        ],
      },
    ],
  },
  {
    name: 'Delivery',
    icon: Truck,
    faqs: [
      {
        id: 'delivery',
        q: 'Where do you deliver and what does it cost?',
        a: [
          'We deliver across all wards of Birgunj Sub-Metropolitan City. Delivery is free on orders above रू 1,000; a flat रू 50 applies below that.',
          'Orders placed before 6:00 PM qualify for same-day delivery. After that, your order arrives the next morning.',
        ],
      },
      {
        id: 'track',
        q: 'How do I track my order?',
        a: [
          'Open My orders from the account menu. Every order shows its live status: pending → confirmed → packed → out for delivery → delivered, with the rider assigned once it is on the road.',
        ],
      },
      {
        id: 'missed',
        q: 'What happens if I miss the delivery?',
        a: [
          'The rider calls you at the number on your profile before arriving. If you miss the call, the rider waits a few minutes and tries once more the same day. After that, the order returns to the shop and is refunded.',
        ],
      },
    ],
  },
  {
    name: 'Payments',
    icon: Wallet,
    faqs: [
      {
        id: 'payment',
        q: 'What payment methods do you accept?',
        a: [
          'Cash on Delivery (COD) is available across Birgunj — pay the rider in cash or with a QR scan at your door.',
          'You can also pay digitally with eSewa at checkout, which confirms your order instantly.',
        ],
      },
      {
        id: 'prices',
        q: 'Are the prices shown final?',
        a: [
          'Yes. The price you see is per unit (kg, litre, piece) and the checkout total — including delivery — is final. If a shop’s price changed after you ordered, you are charged the price shown at checkout.',
        ],
      },
    ],
  },
  {
    name: 'Returns & refunds',
    icon: RotateCcw,
    faqs: [
      {
        id: 'returns',
        q: 'What is the return and refund policy?',
        a: [
          'Fresh produce can be inspected at the doorstep and returned immediately if it does not meet your expectation — you pay nothing for it.',
          'For packaged items, report any issue within 24 hours of delivery from My orders → “Report a problem”, and we will arrange a replacement or refund.',
        ],
      },
      {
        id: 'refund-speed',
        q: 'How fast are refunds?',
        a: [
          'eSewa refunds land back in your wallet within 1–2 working days. COD refunds are returned in cash by the rider on your next delivery, or by bank transfer if you prefer.',
        ],
      },
    ],
  },
  {
    name: 'Account',
    icon: UserCircle2,
    faqs: [
      {
        id: 'account',
        q: 'How do I update my details or delivery address?',
        a: [
          'Open the account menu (top-right) → “My profile”. Your saved name, phone and default address are filled in automatically at checkout, so keeping them current makes every order faster.',
        ],
      },
      {
        id: 'partner',
        q: 'How do I sell on OnlineKirana?',
        a: [
          'Register as a partner, complete your shop profile, and submit it for review. Once an admin approves your shop, you can list products and receive orders directly. See the “Partner with us” page for the full walk-through.',
        ],
      },
    ],
  },
];

export default function Info({ page = 'about' }) {
  const { hash } = useLocation();
  const [open, setOpen] = useState(null);

  // jump to the right anchor when arriving from a deep link — also open it
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const btn = el.querySelector('.faq-q');
        const qid = btn?.dataset.qid;
        if (qid) setOpen(qid);
      }
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [hash, page]);

  if (page === 'faq') {
    return (
      <div className="info-page faq-page">
        <header className="info-head">
          <InfoIcon size={26} aria-hidden="true" />
          <h1>Help &amp; FAQ</h1>
          <p className="muted">Everything you need to know about ordering, delivery, payments and your account.</p>
        </header>

        {CATEGORIES.map((cat) => (
          <section key={cat.name} className="faq-category" aria-labelledby={`faq-${cat.name}`}>
            <h2 id={`faq-${cat.name}`}><cat.icon size={18} aria-hidden="true" /> {cat.name}</h2>
            <div className="info-faq">
              {cat.faqs.map((f) => {
                const isOpen = open === f.id;
                return (
                  <div key={f.id} id={f.id} className={`faq-item${isOpen ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="faq-q"
                      data-qid={f.id}
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : f.id)}
                    >
                      <span>{f.q}</span>
                      <ChevronDown size={17} aria-hidden="true" />
                    </button>
                    <div className={`faq-body${isOpen ? ' open' : ''}`}>
                      <div className="faq-a">
                        {f.a.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

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