import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, ArrowRight, ChevronDown, Store, Bike, ShieldCheck, Compass,
} from 'lucide-react';
import { STOREFRONT_URL } from '@shared/lib/apps';
import useSeo from '@shared/hooks/useSeo';

/**
 * Partner FAQ.
 *
 * A real accordion, matching the storefront's Info/FAQ page: one question open
 * at a time, driven by `.faq-body`'s grid-rows animation, with the same
 * `aria-expanded` / `open` state contract. Previously this page rendered every
 * answer permanently expanded — the `.faq-item` and `.faq-q` classes were there,
 * but there was no state, no chevron and no `.faq-body`, so all ten answers
 * showed at once and the page read as a wall of text.
 *
 * The questions are grouped into the three partner types, which is how someone
 * arriving here actually thinks ("I'm a shopkeeper — which of these are mine?").
 */

const CATEGORIES = [
  {
    name: 'Getting started',
    icon: Compass,
    faqs: [
      {
        id: 'who',
        q: 'Who should use this portal?',
        a: ['Merchants (shop owners), delivery riders and the operations desk. Customers shop on the main OnlineKirana site instead.'],
      },
      {
        id: 'need',
        q: 'What do I need to register?',
        a: ['Just a name, an email address, a phone number and a password. We do not ask for a shop licence, a PAN or VAT card, a citizenship scan, or a driving licence.'],
      },
      {
        id: 'both',
        q: 'Can I sell and deliver at the same time?',
        a: ['No — an account is either a shop or a rider. Register a second account if you want to do both, using a different email address.'],
      },
    ],
  },
  {
    name: 'Shops',
    icon: Store,
    faqs: [
      {
        id: 'register-shop',
        q: 'How do I register my shop?',
        a: ['Open Register, keep “I have a shop” selected, and fill in your shop name, your name, email, phone and a password. An admin reviews and approves new shops before they go live — usually within one working day.'],
      },
      {
        id: 'handover',
        q: 'How does the shop hand an order to a rider?',
        a: ['The shop packs the goods and taps “Mark packed”. The system then finds a rider who is on shift and sends them to the shop. The shop sees the rider’s name and phone so the hand-over is easy.'],
      },
      {
        id: 'fees',
        q: 'What are the merchant fees?',
        a: ['A flat commission per delivered order plus a small payment-handling fee. Exact rates are shown before you publish your first product — no hidden charges.'],
      },
    ],
  },
  {
    name: 'Riders',
    icon: Bike,
    faqs: [
      {
        id: 'become-rider',
        q: 'How do I become a delivery rider?',
        a: ['Open Register, pick “I want to deliver”, and fill in your name, email, phone and a password. Then add the wards you cover and how you travel (bike, cycle, on foot). Once an admin approves you, sign in and tap Go on shift — open jobs then appear for you to take.'],
      },
      {
        id: 'payouts',
        q: 'How do rider payouts work?',
        a: ['Earnings are calculated per completed delivery. Payouts settle weekly to your registered e-wallet or bank account, with a full statement available in your dashboard.'],
      },
      {
        id: 'failed',
        q: 'What happens if a delivery fails?',
        a: ['The job returns to the dispatch pool and the customer is notified automatically. You never need to contact support by hand; the system tracks and resolves failures.'],
      },
    ],
  },
  {
    name: 'Trust & safety',
    icon: ShieldCheck,
    faqs: [
      {
        id: 'data',
        q: 'Is my customers’ data safe?',
        a: ['Customer phone numbers and exact addresses are visible only to the rider actively delivering that order. Admin views are masked. Nothing is shared with third parties.'],
      },
      {
        id: 'support',
        q: 'Who do I contact if something goes wrong?',
        a: ['Reach the operations desk from the contact page on the storefront. For anything blocking a live order, use the in-app support line so the order reference is attached automatically.'],
      },
    ],
  },
];

export default function Faq() {
  // Derived from the URL, not set in an effect: a deep link like /faq#fees should
  // already be open on first render, otherwise the browser jumps to a collapsed
  // question and the answer the visitor asked for is not there.
  const [open, setOpen] = useState(() => window.location.hash.replace('#', '') || null);

  useSeo({
    title: 'Partner FAQ — OnlineKirana Merchants, Riders & Ops',
    description:
      'Answers to common questions about joining OnlineKirana as a shopkeeper, a delivery rider or an operations partner in Birgunj — registration, approval, payouts and documents.',
  });

  // the content has to exist before it can be scrolled to, so the scroll waits
  // a frame; the open state above is already correct by then
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!id) return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="info-page">
      <header className="info-head">
        <CheckCircle2 size={34} aria-hidden="true" />
        <h1>Partner FAQ</h1>
        <p>
          Short answers to the questions we hear most. Can&apos;t find yours?{' '}
          <a className="shop-link" href={`${STOREFRONT_URL}/contact`} target="_blank" rel="noreferrer">
            Contact support on the storefront ↗
          </a>
        </p>
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

      <p className="info-cta">
        Still have a question?{' '}
        <Link to="/join" className="shop-link">Read the join guide →</Link>
      </p>

      <div className="info-cta" style={{ marginTop: '.6rem' }}>
        <Link to="/register" className="cta-btn">
          Register a shop <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
