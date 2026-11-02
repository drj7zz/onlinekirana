import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { PackageOpen, LayoutGrid, ArrowUpDown } from 'lucide-react';
import Dropdown from '../components/Dropdown';
import { useSeo } from '../hooks/useSeo';
import ProductCard from '../components/ProductCard';
import { SkeletonGrid } from '../components/Skeletons';
import RecentStrip from '../components/RecentStrip';
import { getCachedProducts, getCategories, getProducts } from '../lib/catalog';

/** Blinkit-style emoji per category. Anything unmapped falls back to 🛍️. */
const CATEGORY_EMOJI = {
  sabzi: '🥬', phalphul: '🥦', 'chamal-dal': '🍚', chamal: '🍚', dal: '🫘',
  dairy: '🥛', masala: '🌶️', oil: '🫒', atta: '🌾', sugar: '🧂',
  snacks: '🍪', beverages: '🥤', tea: '🍵', coffee: '☕', eggs: '🥚',
  chicken: '🍗', meat: '🥩', fish: '🐟', fruit: '🍎', sweets: '🍬',
  household: '🧼', personal: '🧴', baby: '🍼', frozen: '🧊', bakery: '🍞',
};
const catEmoji = (c) => CATEGORY_EMOJI[String(c).toLowerCase().replace(/\s+/g, '-')] || '🛍️';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [initialCache] = useState(() => {
    const initialParams = new URLSearchParams(window.location.search);
    const query = {};
    if (initialParams.get('search')) query.search = initialParams.get('search');
    if (initialParams.get('category')) query.category = initialParams.get('category');
    if (initialParams.get('sort')) query.sort = initialParams.get('sort');
    return getCachedProducts(query);
  });
  const initialPayload = Array.isArray(initialCache)
    ? { fuzzy: false, items: initialCache }
    : initialCache;
  const [products, setProducts] = useState(() => (
    Array.isArray(initialPayload?.items) ? initialPayload.items : []
  ));
  const [categories, setCategories] = useState(['all']);
  const [search, setSearch] = useState(params.get('search') || '');
  const [category, setCategory] = useState(params.get('category') || 'all');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(!initialPayload);
  const [loadError, setLoadError] = useState('');
  const [fuzzy, setFuzzy] = useState(initialPayload?.fuzzy === true);
  const [reloadKey, setReloadKey] = useState(0);

  /** Reset the category picker and the navbar's search term back to everything. */
  const clearFilters = () => { setSearch(''); setCategory('all'); setSort(''); setFuzzy(false); };

  useEffect(() => {
    let current = true;
    getCategories()
      .then((data) => { if (current) setCategories(['all', ...data]); })
      .catch(() => {});
    return () => { current = false; };
  }, []);

  useEffect(() => {
    // derive state asynchronously so we don't setState synchronously in the effect
    const sync = setTimeout(() => {
      setSearch(params.get('search') || '');
      setCategory(params.get('category') || 'all');
      if (!params.get('search')) setFuzzy(false);
    }, 0);
    return () => clearTimeout(sync);
  }, [params]);

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
      ? `Results for “${search}” — order from local Birgunj shops. Free delivery is available from 5 am–10 pm during launch; late-night delivery may have a distance fee. Pay after delivery.`
      : category !== 'all'
        ? `Buy ${category.toLowerCase()} online from local shops in Birgunj. Free delivery is available from 5 am–10 pm during launch; late-night delivery may have a distance fee. Pay after delivery.`
        : 'Order groceries online from local shops in Birgunj, Nepal. Free delivery from 5 am–10 pm during launch; late-night delivery may have a distance fee when a rider is online. Pay after delivery.',
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
    let current = true;
    const begin = setTimeout(() => {
      setLoadError('');
    }, 0);
    const query = {};
    if (search) query.search = search;
    if (category !== 'all') query.category = category;
    if (sort) query.sort = sort;
    getProducts(query)
      .then((data) => {
       if (current) {
         // the API returns { fuzzy, items } for searches, a bare array otherwise
         const payload = Array.isArray(data) ? { fuzzy: false, items: data } : data;
         setProducts(Array.isArray(payload.items) ? payload.items : []);
         setFuzzy(payload.fuzzy === true);
       }
      })
      .catch(() => { if (current) { setProducts([]); setLoadError('Products could not be loaded. Check your connection and try again.'); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; clearTimeout(begin); };
  }, [search, category, sort, reloadKey]);

  return (
    <>
      {/* The store has no hero, so the page title has to live up here. It is
          visually quiet on purpose — the products are the point. */}
      <div className="page-head">
        <h1>Shop groceries in Birgunj</h1>
      </div>

      {/* Blinkit-style category chips — built from the categories the API
          actually reports, so they always match what shops are selling. */}
      {categories.length > 1 && (
        <div className="cat-chips" role="group" aria-label="Product categories">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={`cat-chip${category === c ? ' active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {/* A face on every chip — recognisable at a glance while the row
                  scrolls horizontally on a phone. */}
              <span className="cat-emoji" aria-hidden="true">{c === 'all' ? '🛒' : catEmoji(c)}</span>
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
        <Dropdown
          label="Category"
          value={category}
          options={categories.map((c) => ({ value: c, label: c === 'all' ? 'All categories' : c }))}
          onChange={setCategory}
          icon={LayoutGrid}
        />
        <Dropdown
          label="Sort"
          value={sort}
          options={[
            { value: '', label: 'Newest' },
            { value: 'price_asc', label: 'Price: low → high' },
            { value: 'price_desc', label: 'Price: high → low' },
            { value: 'name', label: 'Name A–Z' },
          ]}
          onChange={setSort}
          icon={ArrowUpDown}
        />
      </div>

      {/* Skeleton cards hold the grid's shape while the list loads — no layout
          jump when real cards replace them. */}
      {loading ? <SkeletonGrid n={8} /> : loadError ? (
        <div className="empty-state"><strong>Products unavailable</strong><p>{loadError}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div>
      ) : products.length === 0 ? (
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
        <>
          {/* Typo-tolerant notice: every result came from fuzzy matching, so say
              so plainly instead of pretending the exact term matched. */}
          {search && fuzzy && (
            <p className="fuzzy-note" role="status">
              Showing closest matches for <strong>“{search}”</strong>.
              {' '}<button type="button" className="link-btn" onClick={clearFilters}>Clear search</button>
            </p>
          )}
          <div className="grid">
            {products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </>
      )}

      {/* What this shopper looked at before, straight from localStorage — no
          server call, and hidden until there is something to show. */}
      {!loading && !loadError && <RecentStrip />}
    </>
  );
}
