import { Link } from 'react-router-dom';
import { Store, Bike, ShieldCheck, ArrowRight } from 'lucide-react';
import { STOREFRONT_URL } from '@shared/lib/apps';
import useSeo from '@shared/hooks/useSeo';


/**
 * No paperwork. No shop licence, no PAN/VAT, no citizenship scan, no driving
 * licence upload — an account is just a name, an email, a phone and a password.
 * Shops are approved on what they sell and where they deliver; riders are
 * approved on being reachable. Nothing here asks for a document.
 */
const STEPS_MERCHANT = [
  'Go to Register — shopkeepers and riders use the same form, you just pick the right option.',
  'Register your shop: shop name, your name, email, phone and a password. That is the whole form.',
  'We review the shop and approve it (usually the same day).',
  'Fill in your public shop page — description, area, contact.',
  'List your first products. Each one is approved before it goes live.',
  'Start selling. When an order comes in, mark it packed and a rider is sent to your counter automatically.',
];

const STEPS_RIDER = [
  'Go to Register and pick “I want to deliver”. You need your name, email, phone and a password — nothing else.',
  'Tell us the wards you cover and how you travel (bike, cycle, on foot).',
  'Your application reaches the operations desk, who normally approve it the same day.',
  'Sign back in, tap Go on shift, and open jobs start appearing for you to take.',
  'Collect from the shop, drop it off, and read out the customer’s 4-digit hand-over code to finish.',
];

const STEPS_STAFF = [
  'Operations accounts are created internally — there is no public sign-up.',
  'An existing admin adds you from the delivery desk, with a one-time password.',
  'Sign in with it and set your own password when you first arrive.',
];

const PATHS = [
  { icon: Store, title: 'Merchant', steps: STEPS_MERCHANT, note: 'Earn by selling', to: '/register', cta: 'Register a shop' },
  { icon: Bike, title: 'Delivery partner', steps: STEPS_RIDER, note: 'Earn per trip', to: '/register', cta: 'Apply to deliver' },
  { icon: ShieldCheck, title: 'Operations staff', steps: STEPS_STAFF, note: 'Invite only', to: '/login', cta: 'Staff sign in' },
];

export default function Join() {
  useSeo({
    title: 'Join as a Shopkeeper or Delivery Rider — OnlineKirana Birgunj',
    description:
      'Sell groceries online or earn delivering in Birgunj with OnlineKirana. No shop licence, PAN, VAT or document uploads — just a name, email, phone and password to get started.',
  });
  return (
    <div className="info-page">
      <header className="info-head">
        <Store size={34} aria-hidden="true" />
        <h1>How to join OnlineKirana</h1>
        <p>
          Pick the path that matches you. Every role gets a focused workspace inside this
          portal — and joining takes nothing more than an email and a phone number.
        </p>
      </header>

      <div className="join-reassure">
        <h2><ShieldCheck size={18} aria-hidden="true" /> No documents needed</h2>
        <p>
          We do not ask for a shop licence, a PAN or VAT card, a citizenship scan, or a
          driving licence. Registering an account needs only your name, email, phone and a
          password. We approve partners on what they sell and where they deliver, and we
          approve riders on being reachable — that is the whole check.
        </p>
      </div>

      <div className="info-grid">
        {PATHS. map((c) => (
          <div key={c. title} className="info-card">
            <c. icon size={24} aria-hidden="true" />
            <strong>{c. title}</strong>
            <p className="muted" style={{ margin: '.15rem 0 .5rem' }}>{c. note}</p>
            <ol className="info-steps" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.85rem', color: '#555' }}>
              {c. steps. map((s) => <li key={s}>{s}</li>)}
            </ol>
            <Link to={c. to} className="portal-external" style={{ marginTop: '.7rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {c. cta} <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>

      {/* How a merchant and a rider actually meet — the bit people ask about. */}
      <div className="info-block" style={{ marginTop: '1.6rem' }}>
        <h2><Bike size={18} aria-hidden="true" /> How a delivery actually happens</h2>
        <p>
          Nobody has to phone anybody. Once a shopkeeper marks an order packed, the system
          finds a rider who is on shift and assigns the job to them.
        </p>
        <ol className="info-steps" style={{ margin: '.8rem 0 0', paddingLeft: '1.2rem', color: '#444' }}>
          <li>The customer places an order and picks a delivery slot.</li>
          <li>The shop packs the goods and taps <strong>Mark packed</strong>. That is the shopkeeper&apos; s only job.</li>
          <li>A rider on shift is assigned automatically and sets off for the shop. The shop sees the rider&apos; s name and phone.</li>
          <li>The rider taps <strong>I&apos; ve reached the shop</strong> on arrival, collects the goods, then taps <strong>Goods collected</strong>.</li>
          <li>The customer watches the order move to <em>On the way</em> from their own account.</li>
          <li>The rider asks for the 4-digit hand-over code shown in the customer&apos; s order. Only that code can complete the drop.</li>
        </ol>
      </div>

      <div className="info-cta">
        <Link to="/register" className="cta-btn">
          Start registration <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
        </Link>
        <Link to="/faq" className="muted" style={{ marginLeft: '.8rem' }}>Read the FAQ</Link>
        <a href={STOREFRONT_URL} target="_blank" rel="noreferrer" className="muted" style={{ marginLeft: '.8rem' }}>
          Visit the storefront ↗
        </a>
      </div>
    </div>
  );
}
