import { Link } from 'react-router-dom';
import {
  Store, Bike, ShieldCheck, ArrowRight, CheckCircle2, MapPin,
  Wallet, TrendingUp, Clock,
} from 'lucide-react';
import { STOREFRONT_URL } from '@shared/lib/apps';
import useSeo from '@shared/hooks/useSeo';

/**
 * Portal landing.
 *
 * The portal used to render the storefront's generic `.info-*` blocks — the same
 * heading-and-paragraph treatment as the About and FAQ pages. It is the first
 * screen a shopkeeper sees, and it needs to do what those pages don't: say what
 * each kind of partner gets, in what order, and how quickly. So it has its own
 * hero, role cards and numbered steps, styled entirely by `.p-*` classes local to
 * this app (see styles.css) so the shared storefront CSS is untouched.
 */

const ROLES = [
  {
    icon: Store,
    tone: 'green',
    title: 'Shopkeepers',
    lede: 'Put your whole shop online and stop losing sales to stock-outs.',
    points: [
      'List products and photos in minutes',
      'Orders arrive in real time — pack and hand over',
      'Weekly payouts, no setup fee',
    ],
    cta: { to: '/register', label: 'Register a shop' },
  },
  {
    icon: Bike,
    tone: 'amber',
    title: 'Delivery riders',
    lede: 'Set your own hours and see exactly what each trip pays.',
    points: [
      'Choose when you are online',
      'Transparent per-trip earnings',
      'Insurance cover while on a delivery',
    ],
    cta: { to: '/join', label: 'Apply as a rider' },
  },
  {
    icon: ShieldCheck,
    tone: 'slate',
    title: 'Operations desk',
    lede: 'Run the marketplace: orders, dispatch and partner approvals.',
    points: [
      'Oversee every order across the city',
      'Assign riders and watch live status',
      'Invite-only, fully audited access',
    ],
    cta: { to: '/login', label: 'Staff sign in' },
  },
];

const STEPS = [
  {
    title: 'Register',
    body: 'A name, an email, a phone and a password. No shop licence, no PAN, no VAT card, no document uploads.',
  },
  {
    title: 'We approve',
    body: 'Shops are approved on what they sell and where they deliver; riders on being reachable. Usually same day.',
  },
  {
    title: 'Set up',
    body: 'Fill in your shop page or rider profile, then list your first products or claim a shift.',
  },
  {
    title: 'Get paid',
    body: 'Orders come in, a rider is dispatched, and your earnings settle on a weekly cycle.',
  },
];

const PROOF = [
  { icon: Clock, value: '30 min', label: 'Average delivery across Birgunj' },
  { icon: Wallet, value: 'Weekly', label: 'Payout cycle for merchants' },
  { icon: MapPin, value: 'All wards', label: 'Covered inside the city' },
  { icon: TrendingUp, value: 'Zero', label: 'Cost to register your shop' },
];

export default function Home() {
  useSeo({
    title: 'OnlineKirana Partners — Sell Online & Deliver in Birgunj',
    description:
      "OnlineKirana's partner portal for Birgunj: list your grocery shop's products, manage orders, take delivery shifts, or run marketplace operations. Register in minutes — no paperwork.",
  });

  return (
    <div className="p-landing">
      {/* ===== hero ===== */}
      <section className="p-hero">
        <span className="p-pill">
          <MapPin size={12} aria-hidden="true" /> Now live across Birgunj
        </span>
        <h1 className="p-hero-title">
          One portal for every<br />business on <em>OnlineKirana</em>
        </h1>
        <p className="p-hero-sub">
          Shopkeepers, delivery riders and the operations desk each get a clean, focused
          workspace. Customers shop on the{' '}
          <a className="shop-link" href={STOREFRONT_URL} target="_blank" rel="noreferrer">storefront</a> —
          everything behind this portal is for the people who make it run.
        </p>
        <div className="p-hero-actions">
          <Link to="/register" className="cta-btn">
            Become a partner <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
          </Link>
          <Link to="/join" className="p-btn-ghost">How joining works</Link>
        </div>
      </section>

      {/* ===== proof strip ===== */}
      <section className="p-proof" aria-label="At a glance">
        {PROOF.map(({ icon: Icon, value, label }) => (
          <div key={label} className="p-proof-item">
            <Icon size={18} aria-hidden="true" />
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ===== roles ===== */}
      <section className="p-section">
        <header className="p-section-head">
          <h2>Pick the workspace that fits you</h2>
          <p>Same portal, same sign-in. What you see is decided by your role.</p>
        </header>

        <div className="p-role-grid">
          {ROLES.map(({ icon: Icon, tone, title, lede, points, cta }) => (
            <article key={title} className={`p-role p-role-${tone}`}>
              <span className="p-role-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p className="p-role-lede">{lede}</p>
              <ul className="p-role-points">
                {points.map((p) => (
                  <li key={p}>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <Link to={cta.to} className="p-role-cta">
                {cta.label} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ===== steps ===== */}
      <section className="p-section">
        <header className="p-section-head">
          <h2>Live in four steps</h2>
          <p>The whole form is four fields. Nothing here asks you for a document.</p>
        </header>

        <ol className="p-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="p-step">
              <span className="p-step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== closing band ===== */}
      <section className="p-band">
        <div>
          <h2>Ready when you are</h2>
          <p>Register in a couple of minutes, or read the FAQ first if you have questions.</p>
        </div>
        <div className="p-band-actions">
          <Link to="/register" className="cta-btn">
            Register a shop <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
          </Link>
          <Link to="/faq" className="p-btn-ghost">Read the FAQ</Link>
          <a href={STOREFRONT_URL} target="_blank" rel="noreferrer" className="p-btn-ghost">
            Visit the storefront ↗
          </a>
        </div>
      </section>
    </div>
  );
}
