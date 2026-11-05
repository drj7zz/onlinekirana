import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Store, MapPin, Phone, PackageX, CalendarClock } from 'lucide-react';
import API, { imageUrl } from '../api';
import ProductCard from '../components/ProductCard';
import SmartImage from '../components/SmartImage';
import ReviewSection from '../components/ReviewSection';
import { SkeletonGrid } from '../components/Skeletons';
import { useAuth } from '../context/AuthContext';
import { Stars } from './ProductDetail';

export default function Shop() {
  const { id } = useParams();
  const { user } = useAuth();
  // The result is tagged with the shop it belongs to. Navigating from one shop
  // to another then shows the loading state immediately, instead of briefly
  // rendering the previous shop's products under the new name.
  const [result, setResult] = useState({ id: null, data: null, error: '' });

  useEffect(() => {
    let alive = true;
    API.get(`/shops/${id}`)
      .then((r) => { if (alive) setResult({ id, data: r.data, error: '' }); })
      .catch(() => { if (alive) setResult({ id, data: null, error: 'This shop is not available right now.' }); });
    return () => { alive = false; };
  }, [id]);

  const data = result.id === id ? result.data : null;
  const error = result.id === id ? result.error : '';

  if (error) return (
    <div className="empty-state">
      <PackageX size={32} aria-hidden="true" />
      <p>{error}</p>
      <Link to="/" className="cta-btn">Back to shopfront</Link>
    </div>
  );
  if (!data) return <SkeletonGrid n={4} />;

  const { shop, products } = data;

  return (
    <div>
      <div className="shop-hero">
        {/* SmartImage swaps to the leaf fallback if the logo 404s, instead of
            showing the browser's broken-image glyph. */}
        <SmartImage
          src={shop.logoUrl ? imageUrl(shop.logoUrl) : null}
          alt={shop.shopName}
          imgCls="shop-logo"
          fallbackCls="shop-logo shop-logo-fallback"
          fallback={<Store size={26} aria-hidden="true" />}
        />
        <div className="shop-hero-info">
          <h1>{shop.shopName}</h1>
          {shop.ratingCount > 0 && (
            <div className="rating-inline">
              <Stars value={shop.ratingAverage} />
              <span className="muted">{shop.ratingAverage} · {shop.ratingCount} shop review{shop.ratingCount === 1 ? '' : 's'}</span>
            </div>
          )}
          {shop.description && <p>{shop.description}</p>}
          <p className="shop-meta muted">
            <MapPin size={13} aria-hidden="true" /> {(shop.address.line || shop.address.ward) ? `${shop.address.line}${shop.address.ward ? `, Ward ${shop.address.ward}` : ''}, ${shop.address.city}` : 'Birgunj'}
            {shop.phone && <span className="shop-meta-item"><Phone size={13} aria-hidden="true" /> {shop.phone}</span>}
            {shop.memberSince && <span className="shop-meta-item"><CalendarClock size={13} aria-hidden="true" /> since {new Date(shop.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>}
            {shop.mapsUrl && (
              <a className="shop-meta-item shop-maps-link" href={shop.mapsUrl} target="_blank" rel="noreferrer">
                <MapPin size={13} aria-hidden="true" /> Find us on Google Maps
              </a>
            )}
          </p>
        </div>
      </div>

      <h2 className="shop-products-head">Products from this shop ({products.length})</h2>
      {products.length === 0
        ? <p className="empty">This shop has no live products right now.</p>
        : <div className="grid">{products.map((p) => <ProductCard key={p._id} product={p} />)}</div>}

      {/* shop reviews — any logged-in shopper may rate the shop */}
      <ReviewSection
        shopId={shop.id || shop._id}
        kind="shop"
        initialSummary={{ count: shop.ratingCount || 0, average: shop.ratingAverage || 0 }}
        user={user}
      />
    </div>
  );
}
