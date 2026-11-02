import { Link } from 'react-router-dom';
import { Heart, HeartOff } from 'lucide-react';
import { useSeo } from '../hooks/useSeo';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { items, remove } = useWishlist();
  const toast = useToast();

  useSeo({
    title: 'My wishlist | OnlineKirana',
    description: 'Groceries you saved for later at OnlineKirana Birgunj.',
    noindex: true,
  });

  return (
    <div>
      <div className="page-head">
        <h1>My wishlist</h1>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Heart size={34} aria-hidden="true" />
          <strong>Nothing saved yet</strong>
          <p>Tap the heart on any product to save it here for your next shop.</p>
          <Link to="/" className="cta-btn">Browse groceries</Link>
        </div>
      ) : (
        <>
          <p className="muted wl-count">{items.length} saved item{items.length === 1 ? '' : 's'}</p>
          <div className="grid">
            {items.map((p) => (
              <div key={p._id} className="wl-cell">
                <ProductCard product={p} />
                <button
                  type="button"
                  className="wl-remove"
                  onClick={() => { remove(p._id); toast.info('Removed from wishlist'); }}
                  aria-label={`Remove ${p.name} from wishlist`}
                >
                  <HeartOff size={15} aria-hidden="true" /> Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
