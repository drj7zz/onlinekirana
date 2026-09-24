import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, PackageOpen } from 'lucide-react';
import API from '../api';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['all']);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(params.get('category') || 'all');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { API.get('/products/categories').then((r) => setCategories(['all', ...r.data])).catch(() => {}); }, []);

  // keep the URL ?category= in sync so links into a category are shareable
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (category && category !== 'all') next.set('category', category); else next.delete('category');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

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
      <div className="filters">
        <div className="search-wrap">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input placeholder="Search grocery..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Newest</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {loading ? <p className="loading-shimmer">Loading products</p> : products.length === 0 ? (
        <div className="empty-state">
          <PackageOpen size={34} aria-hidden="true" />
          <p>{search || category !== 'all'
            ? 'No products match your search. Try a different keyword or category.'
            : 'No products are available right now. Please check back soon.'}</p>
        </div>
      ) : (
        <div className="grid">
          {products.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </>
  );
}
