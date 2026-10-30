import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import ProductCard from './ProductCard';
import { readRecent, clearRecent } from '../lib/recent';

/**
 * "Recently viewed" strip on the storefront home page.
 *
 * Entries are written by ProductDetail into localStorage (see lib/recent.js) —
 * no server call, so the strip costs nothing and works offline. Hidden when
 * empty, and dismissed for the session with the small ✕ (which only clears the
 * strip's visibility via sessionStorage, not the stored history).
 */
export default function RecentStrip({ excludeId = null }) {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('ok_recent_hidden') === '1');
  const items = readRecent().filter((p) => p._id !== excludeId);

  useEffect(() => {
    sessionStorage.removeItem('ok_recent_hidden');
  }, []);

  if (hidden || items.length === 0) return null;

  return (
    <section className="recent-strip">
      <div className="recent-head">
        <h2><History size={17} aria-hidden="true" /> Recently viewed</h2>
        <button
          type="button"
          className="muted-btn recent-clear"
          onClick={() => { clearRecent(); setHidden(true); sessionStorage.setItem('ok_recent_hidden', '1'); }}
        >
          Clear
        </button>
      </div>
      <div className="recent-scroll">
        {items.map((p) => <ProductCard key={p._id} product={p} />)}
      </div>
      <p className="muted recent-note">
        Kept on this device only — <Link to="/faq">how your data is handled</Link>.
      </p>
    </section>
  );
}
