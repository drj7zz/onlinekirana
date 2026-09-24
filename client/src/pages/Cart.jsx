import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function Cart() {
  const { items, updateQty, remove, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) return <p className="empty">Your cart is khali. <Link to="/">Go shopping</Link></p>;

  return (
    <div>
      <h1>Your Cart</h1>
      <table className="table">
        <thead>
          <tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          {items.map(({ product, qty }) => (
            <tr key={product._id}>
              <td><Link to={`/product/${product._id}`}>{product.name}</Link> <small>({product.unit})</small></td>
              <td>रू {product.finalPrice ?? product.price}</td>
              <td>
                <input type="number" min="1" max={product.stock} value={qty}
                  onChange={(e) => updateQty(product._id, +e.target.value)} />
              </td>
              <td>रू {((product.finalPrice ?? product.price) * qty).toFixed(2)}</td>
              <td><button className="danger" aria-label="Remove" onClick={() => remove(product._id)}><Trash2 size={15} aria-hidden="true" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="total-row">
        <strong>Total: रू {total.toFixed(2)}</strong>
        <button className="cta-btn" onClick={() => navigate('/checkout')}>Proceed to checkout <ArrowRight size={17} className="cta-arrow" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
