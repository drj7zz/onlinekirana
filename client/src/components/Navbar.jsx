import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart, Search, UserCircle2, LogOut, ChevronDown, Menu, X, MapPin,
  Package, Store, HelpCircle, XCircle, Loader2, LayoutGrid,
  Clock, TrendingUp, SearchX, ArrowUpRight, Tag,
} from 'lucide-react';
import API, { imageUrl } from '../api';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { PORTAL_URL } from '../lib/apps';
import { discountBadge, finalPrice, listPrice, rupees } from '../lib/pricing';
import { productPath } from '../lib/productUrl';

/**
 * Storefront navigation.
 *
 * Formatted to match the partner portal: a solid sticky bar driven by the same
 * CSS classes (`.site-header`, `.nav-link`, `.drawer-*`) rather than ad-hoc
 * Tailwind, so the two apps read as one product.
 *
 * The bar is intentionally NOT `backdrop-blur`: blur/filter/transform make an
 * element a containing block for `position: fixed` descendants, which traps the
 * mobile drawer's `fixed inset-0` inside the header strip — the scrim then never
 * covers the page and the panel looks transparent/collapsed. The bar is a solid
 * colour and the drawer is portalled to <body>.
 */

/**
 * Primary nav. `auth: true` links only render once signed in. The partner and
 * portal routes are deliberately absent: they belong to the separate business
 * app, and a shopper has no use for them, so they live in the footer and on the
 * portal's own landing page instead of cluttering the bar.
 */
const NAV_LINKS = [
  { to: '/', label: 'Shop', icon: LayoutGrid, end: true },
  { to: '/orders', label: 'My Orders', icon: Package, auth: true },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
];

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

/** Highlight the matched part of a product name, case-insensitively. */
function Highlight({ text, query }) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="search-hit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

const RECENT_KEY = 'ok_recent_searches';
const MAX_RECENT = 6;

/** Recent searches, most recent first, stored locally and de-duplicated. */
const readRecent = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

const writeRecent = (list) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch { /* private mode */ }
};

/** Fallback suggestions for a first visit, so the panel is never blank. */
const POPULAR = ['rice', 'dal', 'oil', 'chicken', 'soap', 'sabzi'];

/**
 * The search box: a controlled input plus a live suggestions panel.
 *
 * Suggestions come from the same public `/products?search=` endpoint the listing
 * page uses, debounced so typing does not fire a request per keystroke, and
 * sequenced so a slow earlier response can never overwrite a newer one (which
 * would otherwise show stale suggestions for what you just typed).
 */
function SearchBox({ id, onSubmitted }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const [cats, setCats] = useState([]);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const seq = useRef(0);

  // category chips for the browse/idle panel, fetched once and shared by both
  // search boxes so the second one renders instantly
  useEffect(() => {
    let live = true;
    API.get('/products/categories')
      .then((r) => { if (live) setCats(Array.isArray(r.data) ? r.data.slice(0, 8) : []); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setItems([]);
      setStatus('idle');
      return undefined;
    }
    const mine = ++seq.current;
    setStatus('loading');
    // 220ms skips most keystrokes while still feeling live
    const timer = setTimeout(() => {
      API.get('/products', { params: { search: q } })
        .then((r) => {
          if (mine !== seq.current) return; // a newer query already won
          setItems(Array.isArray(r.data) ? r.data.slice(0, 6) : []);
          setStatus('ready');
        })
        .catch(() => {
          if (mine !== seq.current) return;
          setItems([]);
          setStatus('ready');
        });
    }, 220);
    return () => clearTimeout(timer);
  }, [term]);

  // clicking anywhere else closes the panel
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const remember = (q) => {
    const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(next);
  };

  const go = useCallback((path) => {
    setOpen(false);
    setActive(-1);
    onSubmitted?.();
    navigate(path);
  }, [navigate, onSubmitted]);

  const search = (q) => {
    const clean = q.trim();
    if (!clean) return;
    remember(clean);
    setTerm('');
    go(`/?search=${encodeURIComponent(clean)}`);
  };

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(productPath(items[active]));
    search(term);
  };

  // the list of navigable rows: either the live products, or the browse/category
  // rows shown when the field is empty. Keyboard arrows move through whichever
  // set is on screen so ↑/↓ always does something visible.
  const quick = term.trim().length < 2;
  const rowCount = quick ? recent.length + cats.length : items.length;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); inputRef.current?.blur(); return; }
    if (!open || !rowCount) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % rowCount); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + rowCount) % rowCount); }
    else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      if (quick) {
        const row = [...recent, ...cats][active];
        if (recent.includes(row)) search(row);
        else go(`/?category=${encodeURIComponent(row)}`);
      } else {
        go(productPath(items[active]));
      }
    }
  };

  const showPanel = open;
  const listId = `${id}-list`;
  const q = term.trim();

  return (
    <form onSubmit={submit} role="search" className="search-form" ref={boxRef}>
      <div className="search-box">
        <Search size={17} className="search-icon" aria-hidden="true" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search groceries"
          autoComplete="off"
          placeholder='Search "milk", "rice", "sabzi"…'
          value={term}
          onChange={(e) => { setTerm(e.target.value); setActive(-1); setOpen(true); }}
          // `onFocus` alone is not enough: clicking a box that is ALREADY
          // focused fires no focus event, so after a search closed the panel
          // you could never reopen it without clicking away first.
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="search-input"
        />
        {status === 'loading' && term.trim().length >= 2
          ? <Loader2 size={16} className="search-spinner" aria-hidden="true" />
          : term
            ? (
              <button type="button" className="search-clear" onClick={() => { setTerm(''); setOpen(false); inputRef.current?.focus(); }} aria-label="Clear search">
                <XCircle size={16} aria-hidden="true" />
              </button>
            )
            : null}
      </div>

      {showPanel && (
        <div className="search-panel" id={listId} role="listbox">

          {/* --- browse state: nothing typed yet --- */}
          {quick && (
            <>
              {recent.length > 0 && (
                <section className="search-group">
                  <header className="search-group-head">
                    <span><Clock size={12} aria-hidden="true" /> Recent</span>
                    <button type="button" onClick={() => { setRecent([]); writeRecent([]); }}>Clear</button>
                  </header>
                  <ul>
                    {recent.map((r, i) => (
                      <li key={r} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          className={`search-item search-item-plain${i === active ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => search(r)}
                        >
                          <Clock size={14} className="search-row-icon" aria-hidden="true" />
                          <span className="search-item-text"><span className="search-item-name">{r}</span></span>
                          <ArrowUpRight size={14} className="search-row-go" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {cats.length > 0 && (
                <section className="search-group">
                  <header className="search-group-head">
                    <span><Tag size={12} aria-hidden="true" /> Browse categories</span>
                  </header>
                  <ul>
                    {cats.map((c, i) => (
                      <li key={c} role="option" aria-selected={recent.length + i === active}>
                        <button
                          type="button"
                          className={`search-item search-item-plain${recent.length + i === active ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(recent.length + i)}
                          onClick={() => go(`/?category=${encodeURIComponent(c)}`)}
                        >
                          <Tag size={14} className="search-row-icon" aria-hidden="true" />
                          <span className="search-item-text"><span className="search-item-name">{c}</span></span>
                          <ArrowUpRight size={14} className="search-row-go" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {recent.length === 0 && cats.length === 0 && (
                <section className="search-group">
                  <header className="search-group-head">
                    <span><TrendingUp size={12} aria-hidden="true" /> Popular searches</span>
                  </header>
                  <ul>
                    {POPULAR.map((s, i) => (
                      <li key={s} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          className={`search-item search-item-plain${i === active ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => search(s)}
                        >
                          <TrendingUp size={14} className="search-row-icon" aria-hidden="true" />
                          <span className="search-item-text"><span className="search-item-name">{s}</span></span>
                          <ArrowUpRight size={14} className="search-row-go" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* --- results state --- */}
          {!quick && (
            <>
              {status === 'loading' && items.length === 0 && (
                <div className="search-status">
                  <Loader2 size={16} className="search-spinner" aria-hidden="true" />
                  <span>Searching for “{q}”…</span>
                </div>
              )}

              {status === 'ready' && items.length === 0 && (
                <div className="search-status search-empty">
                  <SearchX size={22} aria-hidden="true" />
                  <strong>No match for “{q}”</strong>
                  <span>Try a shorter word, or browse a category instead.</span>
                  <div className="search-empty-chips">
                    {POPULAR.slice(0, 4).map((s) => (
                      <button key={s} type="button" onClick={() => { setTerm(s); search(s); }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {items.length > 0 && (
                <>
                  <ul>
                    {items.map((p, i) => (
                      <li key={p._id} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          className={`search-item${i === active ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(productPath(p))}
                        >
                          {p.imageUrl
                            ? <img src={imageUrl(p.imageUrl)} alt="" className="search-thumb" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            : <span className="search-thumb search-thumb-empty" aria-hidden="true"><Store size={15} /></span>}
                          <span className="search-item-text">
                            <span className="search-item-name"><Highlight text={p.name} query={q} /></span>
                            <span className="search-item-meta">{p.category} · per {p.unit}</span>
                          </span>
                          <span className="search-item-price">
                            {discountBadge(p) && <span className="strike">{rupees(listPrice(p))}</span>}
                            {rupees(finalPrice(p))}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="search-all" onClick={() => search(q)}>
                    See all results for “{q}”
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
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

  const links = NAV_LINKS.filter((l) => !l.auth || user);
  const closeAll = useCallback(() => { setMenuOpen(false); setDrawerOpen(false); }, []);

  const go = (path) => { closeAll(); navigate(path); };
  const doLogout = () => { closeAll(); logout(); navigate('/'); };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* brand */}
        <NavLink to="/" className="brand">
          <img src="/logo.png" alt="OnlineKirana" className="brand-mark" />
          <span className="brand-text">
            <span className="brand-name">online<span>kirana</span></span>
            <span className="brand-tag"><MapPin size={11} aria-hidden="true" /> 30 min delivery · Birgunj</span>
          </span>
        </NavLink>

        {/* search — one input for the whole storefront */}
        <div className="header-search">
          <SearchBox id="nav-search" />
        </div>

        {/* desktop nav */}
        <nav className="nav-links" aria-label="Primary">
          {links.map(({ to, label, icon: Icon, end }) => (
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
                  <button role="menuitem" onClick={() => go('/profile')} className="account-drop-item">
                    <UserCircle2 size={16} aria-hidden="true" /> My profile
                  </button>
                  <button role="menuitem" onClick={() => go('/orders')} className="account-drop-item">
                    <ShoppingCart size={16} aria-hidden="true" /> My orders
                  </button>
                  <button role="menuitem" onClick={doLogout} className="account-drop-item is-danger">
                    <LogOut size={16} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}

          {!user && (
            <button type="button" onClick={() => go('/login')} className="btn-outline">Login</button>
          )}

          {/* the green cart pill — the storefront's signature button */}
          <button type="button" onClick={() => go('/cart')} className="btn-cart">
            <ShoppingCart size={16} aria-hidden="true" />
            <span>{count > 0 ? `${count} item${count > 1 ? 's' : ''}` : 'My Cart'}</span>
          </button>

          {/* the partner portal is a business app — a signed-in shopper has no
              business there, so the link is for guests only */}
          {!user && (
            <a href={PORTAL_URL} target="_blank" rel="noreferrer" className="portal-link">Portal ↗</a>
          )}

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
              /* Signed-in profile block: identity up top, then the account
                 actions a phone user actually wants (orders, profile, logout)
                 as a labelled group, rather than a flat list of link rows. */
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
                  <button onClick={() => go('/orders')} className="drawer-quick">
                    <Package size={18} aria-hidden="true" />
                    <span><strong>My orders</strong><small>Track deliveries</small></span>
                    <ArrowUpRight size={15} className="drawer-quick-go" aria-hidden="true" />
                  </button>
                  <button onClick={() => go('/profile')} className="drawer-quick">
                    <UserCircle2 size={18} aria-hidden="true" />
                    <span><strong>My profile</strong><small>Address &amp; password</small></span>
                    <ArrowUpRight size={15} className="drawer-quick-go" aria-hidden="true" />
                  </button>
                  <button onClick={() => go('/cart')} className="drawer-quick">
                    <ShoppingCart size={18} aria-hidden="true" />
                    <span><strong>My cart</strong><small>{count > 0 ? `${count} item${count > 1 ? 's' : ''}` : 'Nothing yet'}</small></span>
                    <ArrowUpRight size={15} className="drawer-quick-go" aria-hidden="true" />
                  </button>
                </div>
              </section>
            ) : (
              /* Guests get the sign-in prompt here, since the desktop buttons
                 are hidden on small screens. */
              <section className="drawer-guest" aria-label="Sign in">
                <p className="drawer-guest-text">Sign in to track orders, save your ward, and check out faster.</p>
                <div className="drawer-guest-actions">
                  <button onClick={() => go('/login')} className="drawer-cta drawer-cta-solid">Login</button>
                  <button onClick={() => go('/register')} className="drawer-cta drawer-cta-ghost">Register</button>
                </div>
              </section>
            )}

            {/* The drawer's own search. Deliberately NOT auto-focused: focusing
                it opened the suggestions panel straight away, which covered the
                nav links underneath and made the drawer look broken on open. */}
            <div className="drawer-search">
              <SearchBox id="drawer-search" onSubmitted={closeAll} />
            </div>

            <nav className="drawer-links" aria-label="Mobile">
              {links.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={closeAll}
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
              {!user && (
                <a href={PORTAL_URL} target="_blank" rel="noreferrer" className="drawer-portal">Partner portal ↗</a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
