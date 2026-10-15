
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Info as InfoIcon, Mail, ChevronDown,
  Store, Truck, ShieldCheck, CheckCircle2, FileText,
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
          'Browse products, choose quantities and add items to your cart. Review the cart before checkout.',
          'Sign in, add your Birgunj delivery pin, choose an available window, then pay cash after the order arrives.',
        ],
      },
      {
        id: 'change-order',
        q: 'Can I change or cancel my order after placing it?',
        a: [
          'During the pilot you can cancel before the rider collects your order. Cancellations after the shop packs the order count toward a limit of three in a rolling 30-day period; reaching the limit pauses ordering for seven days. Contact support to request a review.',
        ],
      },
      {
        id: 'stock',
        q: 'What if an item goes out of stock after I order?',
        a: [
          'Stock is checked when you place the order. If there is not enough stock, checkout will stop and show the available quantity so you can update your cart.',
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
          'The launch offer is free delivery from 5 am to 10 pm. Late-night delivery from 10 pm to midnight may be offered when an approved rider is online; its estimated charge is रू10 per started kilometer from the shop.',
        ],
      },
      {
        id: 'track',
        q: 'How do I track my order?',
        a: [
          'Open My orders from the account menu to see the latest order and delivery status. The rider is shown after accepting the delivery. Your hand-over code is available on the order card.',
        ],
      },
      {
        id: 'missed',
        q: 'What happens if I miss the delivery?',
        a: [
          'The rider may contact you using the phone number on your order. If delivery cannot be completed, the job returns to the available delivery pool and operations may need to follow up.',
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
          'Pay cash after your order arrives. Advance online payment is not available during the pilot.',
        ],
      },
      {
        id: 'prices',
        q: 'Are the prices shown final?',
        a: [
          'Product prices are per unit. Checkout shows the item total and any late-night delivery estimate before you place the order.',
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
          'The pilot does not offer returns or refunds. Pay only after the order arrives and check the goods at handover. Contact support about an incorrect or damaged order before completing payment.',
        ],
      },
      {
        id: 'refund-speed',
        q: 'Are refunds available during the pilot?',
        a: [
          'Refunds are not offered during the pilot. Online prepayment is disabled, so the order is paid for in cash after arrival.',
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
          <p className="muted">For order questions, include your order number so the team can identify it.</p>
        </header>

        <div className="info-grid">
          <a className="info-card" href="mailto:support@onlinekirana.com">
            <Mail size={20} aria-hidden="true" />
            <strong>Email us</strong>
            <span className="muted">support@onlinekirana.com</span>
          </a>
        </div>

        <p className="muted">Use the email link above and include your order number when asking about an order.</p>
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
        <div className="info-card"><Truck size={20} aria-hidden="true" /><strong>Fast local delivery</strong><span className="muted">Same-day windows when available</span></div>
        <div className="info-card"><ShieldCheck size={20} aria-hidden="true" /><strong>Trusted shops</strong><span className="muted">Verified partner sellers</span></div>
        <div className="info-card"><CheckCircle2 size={20} aria-hidden="true" /><strong>Fresh everyday</strong><span className="muted">Sourced from the local bazaar</span></div>
      </div>

      <section id="terms" className="info-block">
        <h2><FileText size={17} aria-hidden="true" /> Terms of Service</h2>
        <p>By using OnlineKirana you agree to provide accurate delivery details, review product listings and prices before ordering, and use the platform lawfully. Orders are fulfilled by partner shops and are subject to product availability. During the pilot, qualifying repeated cancellations can temporarily pause new orders.</p>
      </section>
      <section id="privacy" className="info-block">
        <h2><ShieldCheck size={17} aria-hidden="true" /> Privacy Policy</h2>
        <p>We collect account, contact and delivery information needed to operate orders. Access is limited by account role. Contact us if you need help with your account or personal information.</p>
      </section>
      <section id="refund" className="info-block">
        <h2><CheckCircle2 size={17} aria-hidden="true" /> Refund Policy</h2>
        <p>No returns or refunds are offered during the pilot. Payment is cash after delivery, not in advance. Please inspect your order at handover and contact support about a missing, damaged or incorrect item before completing payment.</p>
      </section>
      <section id="careers" className="info-block">
        <h2><Store size={17} aria-hidden="true" /> Careers</h2>
        <p>For enquiries about delivery, operations or engineering, email <a className="shop-link" href="mailto:support@onlinekirana.com">support@onlinekirana.com</a>.</p>
      </section>
    </div>
  );
}
