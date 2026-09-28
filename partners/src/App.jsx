import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import RequireRole from './components/RequireRole.jsx';
import usePortalSeo from './hooks/usePortalSeo';

import Landing from './pages/Home.jsx';
import Faq from './pages/Faq.jsx';
import Join from './pages/Join.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Pending from './pages/Pending.jsx';
import Profile from './pages/Profile.jsx';

import Dashboard from './pages/Dashboard.jsx';
import ShopSetup from './pages/ShopSetup.jsx';
import Products from './pages/Products.jsx';
import Orders from './pages/Orders.jsx';
import RiderDashboard from './pages/RiderDashboard.jsx';

import AdminOrders from './pages/AdminOrders.jsx';
import AdminProducts from './pages/AdminProducts.jsx';
import AdminPartners from './pages/AdminPartners.jsx';
import AdminDelivery from './pages/AdminDelivery.jsx';

/**
 * The business portal. Everything that is not a shopper lives here: merchant
 * shops, the delivery fleet, and the operations desk. The public side of
 * partners (landing, FAQ, how to join) is open; the workspaces are guarded.
 */

export default function App() {
  // Titled + noindexed for every guarded workspace; public pages call useSeo
  // themselves with their own search copy.
  usePortalSeo();

  return (
    <div className="app-shell">
      <Navbar />
      <main className="container app-main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/join" element={<Join />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Application-pending notice. Open to any signed-in partner: a brand new
              account has no workspace to enter until an admin approves it. */}
          <Route path="/pending" element={<Pending />} />
          {/* Any signed-in role has a profile. The page adapts its fields and its
              "my orders" shortcut to whichever role is signed in. */}
          <Route path="/profile" element={<RequireRole roles={['merchant', 'delivery', 'admin']}><Profile /></RequireRole>} />

          <Route path="/dashboard" element={<RequireRole roles={['merchant', 'delivery', 'admin']}><Dashboard /></RequireRole>} />
          <Route path="/shop-setup" element={<RequireRole roles={['merchant']}><ShopSetup /></RequireRole>} />
          <Route path="/products" element={<RequireRole roles={['merchant']}><Products /></RequireRole>} />
          <Route path="/orders" element={<RequireRole roles={['merchant']}><Orders /></RequireRole>} />
          <Route path="/rider" element={<RequireRole roles={['delivery']}><RiderDashboard /></RequireRole>} />

          <Route path="/admin/orders" element={<RequireRole roles={['admin']}><AdminOrders /></RequireRole>} />
          <Route path="/admin/products" element={<RequireRole roles={['admin']}><AdminProducts /></RequireRole>} />
          <Route path="/admin/partners" element={<RequireRole roles={['admin']}><AdminPartners /></RequireRole>} />
          <Route path="/admin/delivery" element={<RequireRole roles={['admin']}><AdminDelivery /></RequireRole>} />

          {/* Shoppers belong on the storefront, not here. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
