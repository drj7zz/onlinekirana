import { Link } from 'react-router-dom';
import { ShoppingCart, Leaf } from 'lucide-react';
import { imageUrl } from '../api';
import { useCart } from '../context/CartContext';
import { Stars } from '../pages/ProductDetail';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const out = product.stock <= 0;

  return (
    <div className="card">
      <Link to={`/product/${product._id}`}>
        {product.imageUrl
          ? <img
              src={imageUrl(product.imageUrl)}
              alt={product.name}
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.removeAttribute('hidden'); }}
            />
          : null}
        <div className="img-placeholder" hidden={!!product.imageUrl}><Leaf size={40} aria-hidden="true" /></div>
        <h3>{product.name}</h3>
      </Link>
      {product.ratingCount > 0 && (
        <span className="card-rating">
          <Stars value={product.ratingAverage} size={12} />
          <span className="muted">({product.ratingCount})</span>
        </span>
      )}
      <p className="muted">{product.category} · per {product.unit}</p>
      <div className="price-row">
        {product.discountPercent > 0 && <span className="strike">रू {product.price}</span>}
        <span className="price">रू {product.finalPrice ?? product.price}</span>
        {product.discountPercent > 0 && <span className="off">-{product.discountPercent}%</span>}
      </div>
      <p className={out ? 'stock-out' : 'muted'}>{out ? 'Out of stock' : `${product.stock} in stock`}</p>
      <button disabled={out} onClick={() => add(product)}><ShoppingCart size={16} aria-hidden="true" /> Add to cart</button>
    </div>
  );
}
