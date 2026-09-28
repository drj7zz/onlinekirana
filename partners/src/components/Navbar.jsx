import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Store, Bike, LogOut, ChevronDown, Menu, X, UserCircle2,
  LayoutGrid, Package, HelpCircle, ArrowUpRight, LayoutDashboard,
  Boxes, ShoppingBag, Settings2, ClipboardList, Truck, Users,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/context/AuthContext.jsx';
import { imageUrl } from '@shared/api';
import { STOREFRONT_URL } from '@shared/lib/apps';

/**
 * Partner portal navigation.
 *
 * Built from the storefront's own classes (`.site-header`, `.brand`, `.nav-link`,
 * `.account-*`, `.drawer-*`) rather than ad-hoc Tailwind, so the two apps read as
 * one product. This used to invert the whole bar to a dark, role-tinted header
 * (orange = merchant, cyan = rider, slate = admin) with hand-rolled Tailwind
 * links — the one place the two apps looked like separate products.
 *
 * The layout is now identical to the storefront: brand, links, account cluster,
 * burger. What differs is the link set — a merchant sees their shop, a rider sees
 * their shift, an admin sees the operations desk.
 *
 * Same caveat as the storefront: the bar is NOT `backdrop-blur`, because
 * filter/transform make an element a containing block for `position: fixed`
 * descendants, which traps the mobile drawer's `fixed inset-0` inside the header
 * strip. The drawer is portalled to <body> instead.
 */

/** Route links per role. `public: true` links show for signed-out visitors too. */
const NAV_LINKS = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true, public: true },
  { to: '/join', label: 'How to join', icon: ArrowUpRight, public: true },
  { to: '/faq', label: 'FAQ', icon: HelpCircle, public: true },

  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['merchant', 'delivery', 'admin'] },
  { to: '/orders', label: 'Orders', icon: Package, roles: ['merchant'] },
  { to: '/products', label: 'Products', icon: Boxes, roles: ['merchant'] },
  { to: '/shop-setup', label: 'Shop setup', icon: Settings2, roles: ['merchant'] },
  { to: '/rider', label: 'My shift', icon: Bike, roles: ['delivery'] },

  { to: '/admin/orders', label: 'Orders', icon: ClipboardList, roles: ['admin'] },
  { to: '/admin/products', label: 'Products', icon: ShoppingBag, roles: ['admin'] },
  { to: '/admin/partners', label: 'Partners', icon: Users, roles: ['admin'] },
  { to: '/admin/delivery', label: 'Dispatch', icon: Truck, roles: ['admin'] },
];

/**
 * The workspace quick-actions shown in the account dropdown and mobile drawer.
 * A merchant and an admin both reach "Orders" and "Products", but by different
 * routes — so these are per-role rather than derived from the nav.
 */
const ROLE_QUICK = {
  merchant: [
    { to: '/orders', icon: Package, title: 'Shop orders', sub: 'Pack and hand over' },
    { to: '/products', icon: Boxes, title: 'Products', sub: 'List and edit stock' },
    { to: '/shop-setup', icon: Settings2, title: 'Shop setup', sub: 'Your public page' },
  ],
  delivery: [
    { to: '/rider', icon: Bike, title: 'My shift', sub: 'Pick up and deliver' },
    { to: '/dashboard', icon: LayoutDashboard, title: 'Dashboard', sub: 'Earnings at a glance' },
  ],
  admin: [
    { to: '/admin/orders', icon: ClipboardList, title: 'Orders', sub: 'Oversee every order' },
    { to: '/admin/delivery', icon: Truck, title: 'Dispatch', sub: 'Assign riders' },
    { to: '/admin/partners', icon: Users, title: 'Partners', sub: 'Approve applications' },
  ],
};

const initialsOf = (u) => (u?.name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/**
 * The round avatar, hoisted out of Navbar.
 *
 * Defining a component inside another component re-creates it on every render,
 * which unmounts and remounts the DOM subtree each time. Hoisting also lets the
 * desktop dropdown and the mobile drawer share one implementation.
 */
function Avatar({ user, cls = 'nav-avatar' }) {
  const fallbackCls = `${cls} nav-avatar-fallback`;
  if (!user?.avatarUrl) return <span className={fallbackCls}>{initialsOf(user)}</span>;
  return (
    <img
      src={imageUrl(user.avatarUrl)}
      alt={user?.name}
      className={cls}
      onError={(e) => {
        const span = document.createElement('span');
        span.className = fallbackCls;
        span.textContent = initialsOf(user);
        e.currentTarget.replaceWith(span);
      }}
    />
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    // stop the page behind the drawer from scrolling under it
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // close the profile menu when clicking anywhere else
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const links = NAV_LINKS.filter((l) => l.public || (user && l.roles?.includes(user.role)));
  const closeAll = useCallback(() => { setMenuOpen(false); setDrawerOpen(false); }, []);

  const go = (path) => { closeAll(); navigate(path); };
  const doLogout = () => { closeAll(); logout(); navigate('/'); };

  // An admin reaches both `/orders` and `/admin/orders` labelled "Orders", and
  // both `/products` and `/admin/products` labelled "Products". Rendering all of
  // them would show duplicate rows in the bar, so the workspace pages are grouped
  // by label — whichever comes first wins — and only one of each pair appears.
  // Everything else is still reachable from the account menu and the drawer.
  const seen = new Set();
  const barLinks = [];
  for (const l of links) {
    if (seen.has(l.label)) continue;
    seen.add(l.label);
    barLinks.push(l);
  }

  const quick = ROLE_QUICK[user?.role] || [];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* brand — same lockup as the storefront, retitled for the portal */}
        <NavLink to="/" className="brand">
          <img src="/logo.png" alt="OnlineKirana" className="brand-mark" />
          <span className="brand-text">
            <span className="brand-name">online<span>kirana</span></span>
            <span className="brand-tag"><Store size={11} aria-hidden="true" /> Partner Portal</span>
          </span>
        </NavLink>

        {/* desktop nav */}
        <nav className="nav-links" aria-label="Primary">
          {barLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* right cluster */}
        <div className="nav-actions">
          {user && (
            <div className="account-menu" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-haspopup="menu" aria-expanded={menuOpen} className="account-btn">
                <Avatar user={user} />
                <span className="account-name">{user.name.split(' ')[0]}</span>
                <ChevronDown size={14} className={`account-chevron${menuOpen ? ' is-open' : ''}`} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div role="menu" className="account-drop">
                  <div className="account-drop-head">
                    <Avatar user={user} cls="nav-avatar nav-avatar-lg" />
                    <div className="min-w-0">
                      <div className="account-drop-name">{user.name}</div>
                      <div className="account-drop-email">{user.email}</div>
                    </div>
                  </div>
                  {quick.map(({ to, icon: Icon, title }) => (
                    <button key={to} role="menuitem" onClick={() => go(to)} className="account-drop-item">
                      <Icon size={16} aria-hidden="true" /> {title}
                    </button>
                  ))}
                  <button role="menuitem" onClick={() => go('/profile')} className="account-drop-item">
                    <UserCircle2 size={16} aria-hidden="true" /> My profile
                  </button>
                  <button role="menuitem" onClick={doLogout} className="account-drop-item is-danger">
                    <LogOut size={16} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}

          {!user && (
            <button type="button" onClick={() => go('/login')} className="btn-outline">Sign in</button>
          )}

          {/* The storefront lives on another origin. The storefront header marks
              the mirror-image link with `.portal-link`; reusing it here keeps the
              cross-app affordance identical in both directions. */}
          <a href={STOREFRONT_URL} target="_blank" rel="noreferrer" className="portal-link">Storefront ↗</a>

          {/* mobile hamburger */}
          <button type="button" className="burger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* mobile drawer — portalled to <body> so its `fixed` positioning is
          resolved against the viewport and no ancestor transform/filter can
          swallow it */}
      {drawerOpen && createPortal(
        <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />
          <div className="drawer-panel">
            <div className="drawer-head">
              <span className="drawer-brand">
                <img src="/logo.png" alt="OnlineKirana" className="brand-mark brand-mark-sm" /> OnlineKirana
              </span>
              <button type="button" className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {user ? (
              /* Signed-in profile block: identity up top, then the workspace
                 actions this role actually wants, as a labelled group rather than
                 a flat list of link rows. */
              <section className="drawer-profile" aria-label="Your account">
                <div className="drawer-profile-head">
                  <Avatar user={user} cls="nav-avatar nav-avatar-xl" />
                  <div className="min-w-0">
                    <p className="drawer-profile-name">{user.name}</p>
                    <p className="drawer-profile-email">{user.email}</p>
                    <span className="drawer-profile-role">{user.role}</span>
                  </div>
                </div>
                <div className="drawer-profile-actions">
                  {quick.map(({ to, icon: Icon, title, sub }) => (
                    <button key={to} onClick={() => go(to)} className="drawer-quick">
                      <Icon size={18} aria-hidden="true" />
                      <span><strong>{title}</strong><small>{sub}</small></span>
                      <ArrowUpRight size={15} className="drawer-quick-go" aria-hidden="true" />
                    </button>
                  ))}
                  <button onClick={() => go('/profile')} className="drawer-quick">
                    <UserCircle2 size={18} aria-hidden="true" />
                    <span><strong>My profile</strong><small>Photo &amp; password</small></span>
                    <ArrowUpRight size={15} className="drawer-quick-go" aria-hidden="true" />
                  </button>
                </div>
              </section>
            ) : (
              /* Guests get the sign-in prompt here, since the desktop buttons
                 are hidden on small screens. */
              <section className="drawer-guest" aria-label="Sign in">
                <p className="drawer-guest-text">Sign in to manage your shop, products, orders or delivery shifts.</p>
                <div className="drawer-guest-actions">
                  <button onClick={() => go('/login')} className="drawer-cta drawer-cta-solid">Sign in</button>
                  <button onClick={() => go('/register')} className="drawer-cta drawer-cta-ghost">Register</button>
                </div>
              </section>
            )}

            <nav className="drawer-links" aria-label="Mobile">
              {links.map(({ to, label, icon: Icon, end }, i) => (
                <NavLink key={`${to}-${i}`} to={to} end={end} onClick={closeAll}
                  className={({ isActive }) => `drawer-link${isActive ? ' is-active' : ''}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="drawer-foot">
              {user ? (
                <button onClick={doLogout} className="drawer-link drawer-btn is-danger">
                  <LogOut size={17} aria-hidden="true" /> <span>Log out</span>
                </button>
              ) : null}
              <a href={STOREFRONT_URL} target="_blank" rel="noreferrer" className="drawer-portal">Shop on the storefront ↗</a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
