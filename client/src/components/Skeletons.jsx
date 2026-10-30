/**
 * Skeleton placeholders, shared by both apps (the portal imports this file via
 * `@shared`). A skeleton is the honest loading state: it shows the shape of the
 * page before the data arrives instead of a text line, so layout is stable and
 * the wait feels shorter.
 *
 * <SkeletonGrid n={8} />    → product-card-shaped blocks for listing grids
 * <SkeletonLine w="60%" />  → a single shimmering bar
 * <SkeletonCard />          → detail-page block (big image + text lines)
 * <SkeletonRows n={4} />    → table-shaped rows for catalogue lists
 */

const block = <span className="sk-block" aria-hidden="true" />;

export function SkeletonLine({ w = '100%', h = 14 }) {
  return <span className="sk-block" style={{ width: w, height: h }} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="sk-card" aria-hidden="true">
      <span className="sk-block sk-img" />
      <span className="sk-block sk-line" style={{ width: '85%' }} />
      <span className="sk-block sk-line" style={{ width: '55%' }} />
      <span className="sk-block sk-line" style={{ width: '40%' }} />
      <span className="sk-block sk-btn" />
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="grid" role="status" aria-label="Loading products">
      {Array.from({ length: n }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonRows({ n = 4, cols = 5 }) {
  return (
    <div className="sk-rows" role="status" aria-label="Loading list">
      {Array.from({ length: n }, (_, r) => (
        <div className="sk-row" key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="sk-block" style={{ height: 12, width: c === 0 ? '22%' : '14%' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default block;
