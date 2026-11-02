import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, ShoppingCart, Package, UserCircle2, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/**
 * Mobile bottom tab bar for the storefront.
 *
 * On a phone, the four destinations a shopper actually cycles between — shop,
 * cart, orders, profile — should be one thumb-tap away, not buried behind the
 * hamburger drawer. Rendered only below 720px (CSS hides it on desktop, where
 * the top navbar's horizontal links do the job) and only for signed-in paths
 * that exist: "My Orders" and "Profile" point at guarded routes, so an
 * anonymous visitor tapping them lands on login, which is the correct journey.
 *
 * Hidden on /checkout itself: the sticky checkout bar and the tab bar would
 * fight for the same bottom strip, and there is nothing to navigate away to
 * mid-purchase.
 */
const TABS = [
  { to: '/', label: 'Shop', icon: LayoutGrid, end: true },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/cart', label: 'Cart', icon: ShoppingCart, badge: true },
  { to: '/orders', label: 'Orders', icon: Package, auth: true },
  { to: '/profile', label: 'Profile', icon: UserCircle2, auth: true },
];

export default function BottomTabs() {
  const { user } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();

  // Order confirmation and mid-checkout screens have their own next-step UI.
  if (pathname === '/checkout') return null;

  return (
    <nav className="bottom-tabs" aria-label="Primary, mobile">
      {TABS.map(({ to, label, icon: Icon, end, badge, auth }) => {
        // Hide signed-in-only tabs entirely for anonymous users — an empty
        // "Orders" tab that only opens login reads as broken.
        if (auth && !user) return null;
        return (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <span className="tab-icon">
              <Icon size={21} aria-hidden="true" />
              {badge && count > 0 && <span className="tab-badge">{count > 99 ? '99+' : count}</span>}
            </span>
            <span className="tab-label">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
