import { useState, useRef, useEffect } from 'react';
import { ShoppingCart, UserCircle2, LayoutDashboard, Store, ClipboardList, LogOut, ChevronDown, Menu, X, ShoppingBag } from 'lucide-react';
import { imageUrl } from '../api';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLive } from '../hooks/useLive';
import API from '../api';

// Role-specific navigation tools — each role only sees its own workspace
const NAV_TOOLS = {
  customer: [
    { to: '/', label: 'Shop', end: true },
    { to: '/cart', label: 'Cart', badge: 'cart' },
    { to: '/orders', label: 'My Orders' },
    { to: '/dashboard', label: 'Dashboard' },
  ],
  merchant: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/partners', label: 'My Shop', badge: 'activeOrders' },
    { to: '/orders', label: 'My Orders' },
    { to: '/', label: 'Shopfront', end: true },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/admin/partners', label: 'Approvals', badge: 'pendingApprovals' },
    { to: '/admin/products', label: 'Products' },
    { to: '/admin/orders', label: 'Orders', badge: 'newOrders' },
    { to: '/', label: 'Shopfront', end: true },
  ],
};

// role → navbar background (dark, rich tones so white text always reads)
const ROLE_BG = {
  admin: 'bg-slate-800',
  merchant: 'bg-orange-800',
  customer: 'bg-green-800',
  guest: 'bg-green-800',
};

const initialsOf = (u) => (u?.name || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);

  // close the profile menu when clicking anywhere else
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // live badge counts so admins/partners notice work without leaving the page
  useLive(() => {
    if (!user) { setStats(null); return; }
    API.get('/dashboard').then((r) => setStats(r.data)).catch(() => {});
  }, 15000, [user?._id]);

  const badgeValue = (key) => {
    if (key === 'cart') return count;
    if (!stats) return 0;
    if (key === 'pendingApprovals') {
      return (stats.cards?.find((c) => c.key === 'pendingProducts')?.value || 0)
        + (stats.cards?.find((c) => c.key === 'pendingPartners')?.value || 0);
    }
    const card = stats.cards?.find((c) => c.key === key);
    return card?.value || 0;
  };

  const tools = user ? NAV_TOOLS[user.role] || NAV_TOOLS.customer : [
    { to: '/', label: 'Shop', end: true },
    { to: '/cart', label: 'Cart', badge: 'cart' },
    { to: '/partners', label: 'For Partners' },
    { to: '/login', label: 'Login' },
    { to: '/register', label: 'Register' },
  ];

  const go = (path) => { setMenuOpen(false); setDrawerOpen(false); navigate(path); };
  const doLogout = () => { setMenuOpen(false); setDrawerOpen(false); logout(); navigate('/'); };

  const linkCls = ({ isActive }) =>
    `relative px-3 py-1.5 rounded-lg text-[15px] font-medium text-white/85 transition-colors
     hover:text-white hover:bg-white/10 ${isActive ? 'text-white bg-white/15 font-semibold' : ''}`;

  const badge = (n) => n > 0 && (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-300 text-green-900 text-[11px] font-bold">{n}</span>
  );

  const Avatar = ({ cls = 'w-8 h-8 text-[11px]' }) => {
    const imgCls = `${cls} rounded-full object-cover ring-2 ring-amber-300/80`;
    const fallbackCls = `${cls} rounded-full bg-amber-300 text-green-900 inline-flex items-center justify-center font-extrabold tracking-wide ring-2 ring-amber-300/80`;
    if (!user?.avatarUrl) return <span className={fallbackCls}>{initialsOf(user)}</span>;
    // if the stored photo is missing/unreachable, fall back to initials instead of a broken image
    return (
      <img
        src={imageUrl(user.avatarUrl)}
        alt={user?.name}
        className={imgCls}
        onError={(e) => {
          const span = document.createElement('span');
          span.className = fallbackCls;
          span.textContent = initialsOf(user);
          e.currentTarget.replaceWith(span);
        }}
      />
    );
  };

  const menuItem = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-green-50 hover:text-green-900 transition-colors text-left';

  return (
    <header className={`sticky top-0 z-50 ${ROLE_BG[user?.role || 'guest']} text-white shadow-lg shadow-black/20`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        {/* brand */}
        <NavLink to={user?.role === 'admin' ? '/dashboard' : '/'} className="flex items-center gap-2.5 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-amber-300 text-green-900 flex items-center justify-center shadow">
            <ShoppingCart size={19} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight">Online<span className="text-amber-300">Kirana</span></span>
            <span className="hidden sm:block text-[10px] uppercase tracking-widest text-white/60">
              {user?.role === 'admin' ? 'Admin Console' : user?.role === 'merchant' ? 'Partner Zone' : 'Birgunj'}
            </span>
          </span>
        </NavLink>

        {/* desktop links — always visible, no hover needed */}
        <nav className="hidden md:flex items-center gap-1">
          {tools.map((t) => (
            <NavLink key={t.label} to={t.to} end={t.end} className={linkCls}>
              {t.label}
              {badge(badgeValue(t.badge))}
            </NavLink>
          ))}
        </nav>

        {/* right side: avatar dropdown (desktop only) + mobile hamburger */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border transition-colors
                  ${menuOpen ? 'bg-white/15 border-amber-300/50' : 'bg-white/10 border-white/15 hover:bg-white/15'}`}
              >
                <Avatar />
                <span className="hidden sm:block max-w-[110px] truncate text-sm font-semibold">
                  {user.role === 'merchant' && user.shopName ? user.shopName : user.name.split(' ')[0]}
                </span>
                <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 top-[calc(100%+10px)] w-64 rounded-2xl bg-white text-gray-800 shadow-2xl ring-1 ring-black/5 p-2 origin-top-right animate-[menuIn_.15s_ease-out]">
                  <div className="flex items-center gap-3 px-3 pt-2 pb-3 border-b border-gray-100 mb-1.5">
                    <Avatar cls="w-10 h-10 text-xs" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                  </div>
                  <button role="menuitem" onClick={() => go('/profile')} className={menuItem}>
                    <UserCircle2 size={16} aria-hidden="true" /> My profile
                  </button>
                  <button role="menuitem" onClick={() => go('/dashboard')} className={menuItem}>
                    <LayoutDashboard size={16} aria-hidden="true" /> Dashboard
                  </button>
                  {user.role === 'merchant' && (
                    <button role="menuitem" onClick={() => go('/shop-setup')} className={menuItem}>
                      <Store size={16} aria-hidden="true" /> Shop setup
                    </button>
                  )}
                  {user.role !== 'admin' && (
                    <button role="menuitem" onClick={() => go('/orders')} className={menuItem}>
                      <ClipboardList size={16} aria-hidden="true" /> My orders
                    </button>
                  )}
                  <button role="menuitem" onClick={doLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left">
                    <LogOut size={16} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}

          {!user && (
            <button type="button" onClick={() => go('/login')}
              className="hidden md:inline-block px-4 py-1.5 rounded-lg bg-amber-300 text-green-900 text-sm font-bold hover:bg-amber-200 transition-colors">
              Login
            </button>
          )}

          {/* mobile hamburger */}
          <button type="button" className="md:hidden p-2 rounded-lg hover:bg-white/10" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white text-gray-800 shadow-2xl p-4 flex flex-col animate-[drawerIn_.2s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 font-extrabold text-green-800">
                <ShoppingBag size={18} aria-hidden="true" /> OnlineKirana
              </span>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close menu">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 mb-4">
                <Avatar cls="w-11 h-11 text-xs" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{user.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                </div>
              </div>
            )}

            <nav className="flex flex-col gap-1">
              {tools.map((t) => (
                <NavLink key={t.label} to={t.to} end={t.end} onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) => `px-3 py-2.5 rounded-lg text-[15px] font-medium flex items-center justify-between ${isActive ? 'bg-green-100 text-green-900 font-semibold' : 'hover:bg-gray-100'}`}>
                  {t.label}
                  {badge(badgeValue(t.badge))}
                </NavLink>
              ))}
              {user && (
                <>
                  <div className="my-2 border-t border-gray-100" />
                  <button onClick={() => go('/profile')} className="text-left px-3 py-2.5 rounded-lg text-[15px] hover:bg-gray-100 flex items-center gap-2.5">
                    <UserCircle2 size={16} aria-hidden="true" /> My profile
                  </button>
                  {user.role === 'merchant' && (
                    <button onClick={() => go('/shop-setup')} className="text-left px-3 py-2.5 rounded-lg text-[15px] hover:bg-gray-100 flex items-center gap-2.5">
                      <Store size={16} aria-hidden="true" /> Shop setup
                    </button>
                  )}
                </>
              )}
            </nav>

            {user && (
              <div className="mt-auto">
                <button onClick={doLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition-colors">
                  <LogOut size={16} aria-hidden="true" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
