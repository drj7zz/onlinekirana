import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { imageUrl } from '../api';
import { Stars } from '../pages/ProductDetail';
import AddToCartButton from './AddToCartButton';
import { finalPrice, listPrice, discountBadge, rupees } from '../lib/pricing';
import { productPath } from '../lib/productUrl';

export default function ProductCard({ product }) {
  const out = product.stock <= 0;
  const off = discountBadge(product);

  return (
    <div className="card">
      <Link to={productPath(product)}>
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
      {/* Always render the rating row so cards with and without reviews occupy
          the same height; without this the rows below sit at different offsets. */}
      <span className="card-rating" aria-hidden={product.ratingCount === 0}>
        {product.ratingCount > 0 ? (
          <>
            <Stars value={product.ratingAverage} size={12} />
            <span className="muted">({product.ratingCount})</span>
          </>
        ) : null}
      </span>
      <p className="muted">{product.category} · per {product.unit}</p>
      <div className="price-row">
        {off && <span className="strike">{rupees(listPrice(product))}</span>}
        <span className="price">{rupees(finalPrice(product))}</span>
        {off && <span className="off">{off}</span>}
      </div>
      <p className={out ? 'stock-out' : 'muted'}>{out ? 'Out of stock' : `${product.stock} in stock`}</p>
      <AddToCartButton product={product} compact />
    </div>
  );
}
