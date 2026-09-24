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
import ShopSetup from './pages/ShopSetup';
import Partners from './pages/Partners';
import Dashboard from './pages/Dashboard';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';
import AdminPartners from './pages/AdminPartners';
import Info from './pages/Info';
import NotFound from './pages/NotFound';
import RoleGuard from './components/RoleGuard';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
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
          <Route path="/shop-setup" element={<RoleGuard role="merchant"><ShopSetup /></RoleGuard>} />
          <Route path="/partners" element={<RoleGuard role="merchant"><Partners /></RoleGuard>} />
          <Route path="/admin/products" element={<RoleGuard role="admin"><AdminProducts /></RoleGuard>} />
          <Route path="/admin/orders" element={<RoleGuard role="admin"><AdminOrders /></RoleGuard>} />
          <Route path="/admin/partners" element={<RoleGuard role="admin"><AdminPartners /></RoleGuard>} />
          <Route path="/about" element={<Info page="about" />} />
          <Route path="/faq" element={<Info page="faq" />} />
          <Route path="/contact" element={<Info page="contact" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
