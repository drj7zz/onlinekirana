import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';
import API from '../api';
import { useSeo } from '../hooks/useSeo';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['all']);
  const [search, setSearch] = useState(params.get('search') || '');
  const [category, setCategory] = useState(params.get('category') || 'all');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);

  /** Reset the category picker and the navbar's search term back to everything. */
  const clearFilters = () => { setSearch(''); setCategory('all'); };

  useEffect(() => { API.get('/products/categories').then((r) => setCategories(['all', ...r.data])).catch(() => {}); }, []);

  // The listing title reflects what the shopper is actually looking at, so a
  // category or keyword page can rank for the term that led to it. A search
  // result is deliberately not indexed — those are thin, infinite variations.
  useSeo({
    title: search
      ? `"${search}" — search results | OnlineKirana`
      : category !== 'all'
        ? `${category} — order online in Birgunj | OnlineKirana`
        : 'Online Grocery Delivery in Birgunj | OnlineKirana',
    description: search
      ? `Results for “${search}” — order from local Birgunj shops with 30-minute delivery and cash on delivery.`
      : category !== 'all'
        ? `Buy ${category.toLowerCase()} online from local shops in Birgunj. 30-minute ward-wise delivery, cash on delivery or eSewa.`
        : 'Order groceries online from local shops across Birgunj, Nepal. 30-minute ward-wise delivery, cash on delivery or eSewa.',
    noindex: Boolean(search),
  });

  // keep the URL ?category=/?search= in sync so links into a category or a
  // search are shareable (and the navbar's search lands here pre-filled)
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (search) next.set('search', search); else next.delete('search');
    if (category && category !== 'all') next.set('category', category); else next.delete('category');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (category !== 'all') params.category = category;
    if (sort) params.sort = sort;
    API.get('/products', { params })
      .then((r) => setProducts(r.data))
      .finally(() => setLoading(false));
  }, [search, category, sort]);

  return (
    <>
      {/* The store has no hero, so the page title has to live up here. It is
          visually quiet on purpose — the products are the point. */}
      <div className="page-head">
        <h1>Shop groceries in Birgunj</h1>
        <p>
          Order from local shops across Birgunj, delivered to your ward.
          Cash on delivery, or pay with eSewa.
        </p>
      </div>

      {/* Blinkit-style category chips — built from the categories the API
          actually reports, so they always match what shops are selling. */}
      {categories.length > 1 && (
        <div className="cat-chips" role="tablist" aria-label="Product categories">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              className={`cat-chip${category === c ? ' active' : ''}`}
              onClick={() => setCategory(c)}
            >
              <span>{c === 'all' ? 'All' : c}</span>
            </button>
          ))}
        </div>
      )}

      {/* No search box here on purpose: the navbar already owns the one search
          input for the whole site. A second box on this page meant two controls
          fighting over the same ?search= param, and one of them was always out
          of step. This row is now only the filters that are specific to the
          listing (category + sort), which also lines the page up with the
          navbar's search sitting directly above it. */}
      <div className="filters">
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
        <select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Newest</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {loading ? <p className="loading-shimmer">Loading products</p> : products.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <strong>{search || category !== 'all' ? 'Nothing matched that search' : 'The shelves are being filled'}</strong>
          <p>{search || category !== 'all'
            ? 'No products match your search. Try a different keyword in the search bar above, or clear the category filter.'
            : 'Local shops are still stocking their shelves. Check back shortly, or browse the shops already trading.'}</p>
          {(search || category !== 'all') ? (
            <button onClick={clearFilters}>Clear search and filters</button>
          ) : (
            <Link to="/faq" className="muted">How OnlineKirana works</Link>
          )}
        </div>
      ) : (
        <div className="grid">
          {products.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </>
  );
}
