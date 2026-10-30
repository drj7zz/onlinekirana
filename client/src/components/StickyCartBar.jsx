import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { rupees } from '../lib/pricing';

/**
 * Sticky mobile checkout bar.
 *
 * On a phone the cart summary lives far below the product grid; once something
 * is in the cart this bar pins the count and total to the bottom of every
 * storefront page (hidden on desktop and on the cart/checkout pages themselves,
 * where the same actions already exist at full size). One tap goes to the cart,
 * where checkout happens — matching the "one seller per cart" rule, which is
 * surfaced on the cart page rather than duplicated here.
 */
export default function StickyCartBar() {
  const { count, total, items } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!count || count === 0) return null;
  if (pathname === '/cart' || pathname === '/checkout') return null;
  if (!user) return null; // checkout requires a signed-in shopper anyway

  return (
    <div className="sticky-cart">
      <Link to="/cart" className="sticky-cart-info">
        <ShoppingCart size={19} aria-hidden="true" />
        <span>
          <strong>{count} item{count === 1 ? '' : 's'}</strong>
          <small>{rupees(total)} · {items[0]?.product?.merchant?.shopName || 'your cart'}</small>
        </span>
      </Link>
      <button type="button" className="cta-btn sticky-cart-go" onClick={() => navigate('/cart')}>
        View cart <ArrowRight size={16} className="cta-arrow" aria-hidden="true" />
      </button>
    </div>
  );
}
