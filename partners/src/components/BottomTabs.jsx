import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, Truck, UserCircle2, Store,
  Boxes, Settings2, Bike, CircleHelp, LogIn, Clock,
} from 'lucide-react';
import { useAuth } from '@shared/context/AuthContext.jsx';

const GUEST_TABS = [
  { to: '/', label: 'Home', icon: Store, end: true },
  { to: '/join', label: 'Join', icon: CircleHelp },
  { to: '/faq', label: 'FAQ', icon: CircleHelp },
  { to: '/login', label: 'Sign in', icon: LogIn },
];

const WORKSPACE_TABS = {
  merchant: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/orders', label: 'Orders', icon: ClipboardList },
    { to: '/inventory', label: 'Inventory', icon: Boxes },
    { to: '/shop-setup', label: 'Shop & profile', icon: Settings2 },
  ],
  delivery: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/rider', label: 'My shift', icon: Bike },
    { to: '/profile', label: 'Profile', icon: UserCircle2 },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/partners', label: 'Approvals', icon: Users },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/delivery', label: 'Dispatch', icon: Truck },
    { to: '/profile', label: 'Profile', icon: UserCircle2 },
  ],
};

export default function BottomTabs() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  let tabs = GUEST_TABS;
  if (user) {
    const pending = (user.role === 'merchant' && ['pending', 'suspended'].includes(user.merchantStatus))
      || (user.role === 'delivery' && ['pending', 'suspended'].includes(user.riderStatus));
    tabs = pending
      ? [
        { to: '/pending', label: 'Application', icon: Clock },
        { to: '/profile', label: 'Profile', icon: UserCircle2 },
      ]
      : WORKSPACE_TABS[user.role] || [];
  }

  return (
    <nav className="bottom-tabs partner-bottom-tabs" aria-label="Primary, mobile">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `tab${isActive || (to === '/dashboard' && pathname === '/') ? ' active' : ''}`}
        >
          <span className="tab-icon"><Icon size={21} aria-hidden="true" /></span>
          <span className="tab-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
