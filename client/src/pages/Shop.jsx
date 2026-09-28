import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Store, MapPin, Phone, PackageX, CalendarClock } from 'lucide-react';
import API, { imageUrl } from '../api';
import ProductCard from '../components/ProductCard';

export default function Shop() {
  const { id } = useParams();
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
  if (!data) return <p className="loading-shimmer">Loading shop</p>;

  const { shop, products } = data;

  return (
    <div>
      <div className="shop-hero">
        {shop.logoUrl
          ? <img src={imageUrl(shop.logoUrl)} alt={shop.shopName} className="shop-logo" />
          : <div className="shop-logo shop-logo-fallback"><Store size={26} aria-hidden="true" /></div>}
        <div className="shop-hero-info">
          <h1>{shop.shopName}</h1>
          {shop.description && <p>{shop.description}</p>}
          <p className="muted">
            <MapPin size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" />
            {(shop.address.line || shop.address.ward) ? `${shop.address.line}${shop.address.ward ? `, Ward ${shop.address.ward}` : ''}, ${shop.address.city}` : 'Birgunj'}
            {shop.phone && <> · <Phone size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> {shop.phone}</>}
            {shop.memberSince && <> · <CalendarClock size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> since {new Date(shop.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</>}
          </p>
        </div>
      </div>

      <h2 style={{ margin: '1.2rem 0 .8rem' }}>Products from this shop ({products.length})</h2>
      {products.length === 0
        ? <p className="empty">This shop has no live products right now.</p>
        : <div className="grid">{products.map((p) => <ProductCard key={p._id} product={p} />)}</div>}
    </div>
  );
}
