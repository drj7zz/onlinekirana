import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Leaf, Store, Star, MapPin, Phone, PackageX,
  Truck, ShieldCheck, Minus, Plus, ChevronRight, BadgeCheck,
} from 'lucide-react';
import API, { imageUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLive } from '../hooks/useLive';
import { useSeo } from '../hooks/useSeo';
import ProductCard from '../components/ProductCard';
import AddToCartButton from '../components/AddToCartButton';
import ReviewSection from '../components/ReviewSection';
import { finalPrice, listPrice, discountBadge, savedPerUnit, rupees } from '../lib/pricing';
import { productPath, productIdFromPath } from '../lib/productUrl';

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
  const { id: slug } = useParams();
  const navigate = useNavigate();
  // `/product/chino-eggs-6ab9cee…` and `/product/6ab9cee…` are the same product:
  // the name is cosmetic, the trailing id is the real key.
  const id = productIdFromPath(slug);
  const { user } = useAuth();
  const { qtyOf } = useCart();

  // The loaded product is tagged with the id it belongs to, and the quantity /
  // "added" flag carry that id too. Comparing the tag at render time means moving
  // to another product resets them by derivation, with no setState inside an
  // effect body (which React flags as a cascading-render risk) and no window in
  // which the previous product's price or quantity is shown.
  const [result, setResult] = useState({ id: null, data: null, error: '' });
  const [qty, setQty] = useState({ id: null, value: 1 });

  const load = useCallback(() => {
    let alive = true;
    API.get(`/products/${id}`)
      .then((r) => { if (alive) setResult({ id, data: r.data, error: '' }); })
      .catch(() => { if (alive) setResult({ id, data: null, error: 'This product is not available right now.' }); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return load();
  }, [load]);

  // Stock and price are re-read while the page is open, so a shopper looking at
  // a product while someone else buys the last one sees it go out of stock
  // without touching refresh — the buy control disables itself immediately.
  useLive(() => { API.get(`/products/${id}`).then((r) => setResult({ id, data: r.data, error: '' })).catch(() => {}); }, 15000, [id]);

  const product = result.id === id ? result.data : null;
  const error = result.id === id ? result.error : '';

  // Send a bare-id or stale-slug URL to the canonical name+id address, so there
  // is exactly one indexable URL per product and the name in the address bar
  // always matches the product.
  useEffect(() => {
    if (!product) return;
    const canonical = productPath(product);
    if (slug !== canonical.replace('/product/', '')) {
      navigate(canonical, { replace: true });
    }
  }, [product, slug, navigate]);

  // The title and description are the ones that actually rank. The product name
  // leads, then the shop and unit, then the searchable category terms a buyer
  // would plausibly type in Birgunj.
  useSeo({
    title: product
      ? `${product.name} — buy online in Birgunj | OnlineKirana`
      : 'Loading product… | OnlineKirana',
    description: product
      ? `${product.name} (${product.unit}) from ${product.merchant?.shopName || 'a local Birgunj shop'}. ${rupees(finalPrice(product))} with 30-minute delivery across Birgunj. Cash on delivery.`
      : 'Loading product details from OnlineKirana, your Birgunj online grocery store.',
    image: product?.imageUrl ? imageUrl(product.imageUrl) : undefined,
    type: 'product',
  });

  // Derived, not stored: a change of product resets both automatically.
  const quantity = qty.id === id ? qty.value : 1;
  const setQuantity = (value) => setQty({ id, value });

  if (error) return (
    <div className="empty-state">
      <PackageX size={32} aria-hidden="true" />
      <p>{error}</p>
      <Link to="/" className="cta-btn">Back to shopfront</Link>
    </div>
  );
  if (!product) return <p className="loading-shimmer">Loading product</p>;

  const out = product.stock <= 0;
  const now = finalPrice(product);
  const was = listPrice(product);
  const off = discountBadge(product);
  const maxQty = Math.max(1, product.stock);
  const setQ = (n) => setQuantity(Math.min(maxQty, Math.max(1, Number(n) || 1)));
  const shop = product.merchant;

  // how many of this product the shopper already has in the cart
  const inCart = qtyOf(product._id);

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

          {/* Price block. The struck-through original and the discount badge are
              both derived from the same maths the payable price uses, so a
              badge can never advertise a saving the price does not reflect. */}
          <div className="price-row pdp-price">
            {off && <span className="strike">{rupees(was)}</span>}
            <span className="price big">{rupees(now)}</span>
            {off && <span className="off">-{off}</span>}
            {off && <span className="pdp-save">You save {rupees(savedPerUnit(product))} per {product.unit}</span>}
          </div>

          <p className={out ? 'stock-out' : 'muted'}>
            {out ? 'Out of stock' : `${product.stock} ${product.unit} available`}
          </p>

          {/* Quantity picker. The actual add action lives in the buy control
              below — an earlier build had a second "Add to cart" button here,
              so the page offered two competing ways to do the same thing. */}
          {!out && (
            <div className="qty-row">
              <span className="qty-label">Quantity</span>
              <div className="qty-stepper">
                <button type="button" onClick={() => setQ(quantity - 1)} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus size={15} aria-hidden="true" /></button>
                <input
                  type="number" min="1" max={maxQty} value={quantity}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Quantity to add"
                />
                <button type="button" onClick={() => setQ(quantity + 1)} disabled={quantity >= maxQty} aria-label="Increase quantity"><Plus size={15} aria-hidden="true" /></button>
              </div>
              <span className="qty-each muted">{rupees(now)} each</span>
            </div>
          )}

          <div className="pdp-buy">
            <AddToCartButton product={product} showBuyNow initialQty={quantity} />
            {!out && (
              <p className="muted buy-hint">
                {inCart > 0
                  ? <>{inCart} already in your cart. Use − and + to change it.</>
                  : <>Add to cart to keep browsing, or Buy now to check out straight away.</>}
              </p>
            )}
          </div>


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
          {product.discountPercent > 0 && <div><dt>Discount</dt><dd>{off} off — you save {rupees(savedPerUnit(product))}</dd></div>}
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
