import { Link } from 'react-router-dom';
import { Leaf, Heart } from 'lucide-react';
import { imageUrl } from '../api';
import SmartImage from './SmartImage';
import { Stars } from '../pages/ProductDetail';
import AddToCartButton from './AddToCartButton';
import { finalPrice, listPrice, discountBadge, rupees } from '../lib/pricing';
import { productPath } from '../lib/productUrl';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';

export default function ProductCard({ product }) {
  const out = product.stock <= 0;
  const off = discountBadge(product);
  const wishlist = useWishlist();
  const toast = useToast();
  const saved = wishlist.has(product._id);

  const toggleWishlist = () => {
    if (!saved && wishlist.isFull) {
      toast.error('Your wishlist is full. Remove an item to save another.');
      return;
    }
    wishlist.toggle(product);
    toast.info(saved ? 'Removed from wishlist' : 'Saved to wishlist');
  };

  return (
    <div className="card">
      {/* save-for-later heart + badge chips float over the image */}
      <div className="card-media">
        <Link to={productPath(product)}>
          <SmartImage
            src={product.imageUrl ? imageUrl(product.imageUrl) : null}
            alt={product.name}
            imgCls=""
            fallbackCls="img-placeholder"
            fallback={<Leaf size={40} aria-hidden="true" />}
          />
        </Link>
        <div className="card-badges" aria-hidden="false">
          {product.bestseller && <span className="badge badge-hot">Bestseller</span>}
          {product.isNew && <span className="badge badge-new">New</span>}
        </div>
        <button
          type="button"
          className={`wl-heart${saved ? ' is-saved' : ''}`}
          onClick={toggleWishlist}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart size={16} aria-hidden="true" />
        </button>
      </div>
      <Link to={productPath(product)}>
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
