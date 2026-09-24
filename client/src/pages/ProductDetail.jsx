import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Leaf, ShoppingCart, Store, Star, MapPin, Phone, PackageX,
  Truck, ShieldCheck, Minus, Plus, ChevronRight, BadgeCheck,
} from 'lucide-react';
import API, { imageUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import ReviewSection from '../components/ReviewSection';

// Small 5-star row reused in the header + review summary
export function Stars({ value = 0, size = 15 }) {
  const filled = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          className={n <= filled ? 'star-on' : 'star-off'}
          fill={n <= filled ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();

  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    return API.get(`/products/${id}`)
      .then((r) => setProduct(r.data))
      .catch(() => setError('This product isn\'t available right now.'));
  }, [id]);

  useEffect(() => { setProduct(null); load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [load]);
  useEffect(() => { setQty(1); setAdded(false); }, [id]);

  if (error) return (
    <div className="empty-state">
      <PackageX size={32} aria-hidden="true" />
      <p>{error}</p>
      <Link to="/" className="cta-btn">Back to shopfront</Link>
    </div>
  );
  if (!product) return <p className="loading-shimmer">Loading product</p>;

  const out = product.stock <= 0;
  const finalPrice = product.finalPrice ?? product.price;
  const maxQty = Math.max(1, product.stock);
  const setQ = (n) => setQty(Math.min(maxQty, Math.max(1, Number(n) || 1)));
  const shop = product.merchant;

  const addToCart = () => {
    add(product, qty);
    setAdded(true);
  };

  return (
    <div className="pdp">
      {/* breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Shopfront</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to={`/?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{product.name}</span>
      </nav>

      <div className="detail">
        {/* image */}
        <div className="detail-media">
          {product.imageUrl && (
            <img
              src={imageUrl(product.imageUrl)}
              alt={product.name}
              className="detail-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.removeAttribute('hidden'); }}
            />
          )}
          <div className="img-placeholder big" hidden={!!product.imageUrl}>
            <Leaf size={64} aria-hidden="true" />
          </div>
        </div>

        {/* buy box */}
        <div className="detail-buy">
          <h1>{product.name}</h1>

          {product.ratingCount > 0 && (
            <div className="rating-inline">
              <Stars value={product.ratingAverage} />
              <span className="muted">{product.ratingAverage} · {product.ratingCount} review{product.ratingCount === 1 ? '' : 's'}</span>
            </div>
          )}

          <p className="muted">{product.category} · sold per {product.unit}</p>

          {shop?._id && shop.merchantStatus === 'approved' && (
            <p className="sold-by">
              <Store size={14} aria-hidden="true" /> Sold by{' '}
              <Link to={`/shop/${shop._id}`} className="shop-link">{shop.shopName}</Link>
            </p>
          )}

          <div className="price-row">
            {product.discountPercent > 0 && <span className="strike">रू {product.price}</span>}
            <span className="price big">रू {finalPrice}</span>
            {product.discountPercent > 0 && <span className="off">-{product.discountPercent}%</span>}
          </div>

          <p className={out ? 'stock-out' : 'muted'}>
            {out ? 'Out of stock' : `${product.stock} ${product.unit} available`}
          </p>

          {!out && (
            <div className="qty-row">
              <div className="qty-stepper">
                <button type="button" onClick={() => setQ(qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity"><Minus size={15} aria-hidden="true" /></button>
                <input
                  type="number" min="1" max={maxQty} value={qty}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Quantity"
                />
                <button type="button" onClick={() => setQ(qty + 1)} disabled={qty >= maxQty} aria-label="Increase quantity"><Plus size={15} aria-hidden="true" /></button>
              </div>
              <button className="cta-btn" onClick={addToCart}>
                <ShoppingCart size={16} aria-hidden="true" /> Add to cart
              </button>
            </div>
          )}

          {added && (
            <p className="added-msg">
              Added to cart. <Link to="/cart" className="shop-link">Go to cart →</Link>
            </p>
          )}

          {/* trust strip */}
          <ul className="trust-strip">
            <li><Truck size={15} aria-hidden="true" /> Delivered across Birgunj</li>
            <li><ShieldCheck size={15} aria-hidden="true" /> Cash on delivery supported</li>
          </ul>
        </div>
      </div>

      {/* description */}
      <section className="pdp-block">
        <h2>Product details</h2>
        {product.description
          ? <p className="pdp-desc">{product.description}</p>
          : <p className="muted">No description provided for this product yet.</p>}
        <dl className="pdp-specs">
          <div><dt>Category</dt><dd>{product.category}</dd></div>
          <div><dt>Sold per</dt><dd>{product.unit}</dd></div>
          <div><dt>Availability</dt><dd>{out ? 'Out of stock' : `${product.stock} ${product.unit}`}</dd></div>
          {product.discountPercent > 0 && <div><dt>Discount</dt><dd>{product.discountPercent}% off</dd></div>}
        </dl>
      </section>

      {/* shop card */}
      {shop?._id && shop.merchantStatus === 'approved' && (
        <section className="pdp-block">
          <h2>Sold by</h2>
          <div className="shop-inline">
            {shop.shopLogoUrl
              ? <img src={imageUrl(shop.shopLogoUrl)} alt={shop.shopName} className="shop-inline-logo" />
              : <div className="shop-inline-logo shop-logo-fallback"><Store size={22} aria-hidden="true" /></div>}
            <div className="shop-inline-info">
              <Link to={`/shop/${shop._id}`} className="shop-inline-name">
                {shop.shopName} <BadgeCheck size={15} aria-hidden="true" className="shop-verif" />
              </Link>
              {shop.shopDescription && <p className="muted">{shop.shopDescription}</p>}
              {(shop.shopAddress?.line || shop.shopAddress?.ward) && (
                <p className="muted">
                  <MapPin size={13} aria-hidden="true" />{' '}
                  {shop.shopAddress?.line}
                  {shop.shopAddress?.ward ? `, Ward ${shop.shopAddress.ward}` : ''}
                  {shop.shopAddress?.city ? `, ${shop.shopAddress.city}` : ''}
                </p>
              )}
              {shop.shopPhone && <p className="muted"><Phone size={13} aria-hidden="true" /> {shop.shopPhone}</p>}
            </div>
            <Link to={`/shop/${shop._id}`} className="cta-btn visit-shop-btn">Visit shop</Link>
          </div>
        </section>
      )}

      {/* reviews */}
      <ReviewSection
        productId={product._id}
        initialSummary={{ count: product.ratingCount || 0, average: product.ratingAverage || 0 }}
        user={user}
        onChanged={load}
      />

      {/* related */}
      {product.related?.length > 0 && (
        <section className="pdp-block">
          <h2>More in {product.category}</h2>
          <div className="grid">
            {product.related.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
