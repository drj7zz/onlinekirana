import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import Dashboard from './pages/Dashboard';
import Info from './pages/Info';
import NotFound from './pages/NotFound';
import RoleGuard from './components/RoleGuard';

/**
 * The storefront. Shoppers only — the merchant, delivery and operations
 * workspaces live in the separate partners app (VITE_PARTNERS_URL).
 * The partner sign-up journey is reached from that app, not from here.
 */
export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="container app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<RoleGuard role="customer"><Checkout /></RoleGuard>} />
          <Route path="/orders" element={<RoleGuard role="customer"><Orders /></RoleGuard>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<RoleGuard><Profile /></RoleGuard>} />
          <Route path="/shop/:id" element={<Shop />} />
          <Route path="/about" element={<Info page="about" />} />
          <Route path="/faq" element={<Info page="faq" />} />
          <Route path="/contact" element={<Info page="contact" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
