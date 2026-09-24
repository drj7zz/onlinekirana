import { useEffect, useState } from 'react';
import { Star, MessageSquare, LoaderCircle, BadgeCheck, Trash2 } from 'lucide-react';
import API from '../api';
import { Stars } from '../pages/ProductDetail';

const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Product reviews: summary (average + star bars), the list, and a form.
 * Anyone logged in can review; "verified" marks buyers with a delivered order.
 */
export default function ReviewSection({ productId, initialSummary, user, onChanged }) {
  const [summary, setSummary] = useState(initialSummary || { count: 0, average: 0, breakdown: [] });
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    API.get(`/reviews/product/${productId}`)
      .then((r) => { setSummary(r.data.summary); setReviews(r.data.reviews); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [productId]);

  const mine = user ? reviews.find((r) => r.user === user._id) : null;

  const submit = (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setError('');
    API.post(`/reviews/product/${productId}`, { rating, comment })
      .then(() => { setComment(''); setRating(5); load(); onChanged?.(); })
      .catch((err) => setError(err.response?.data?.message || 'Could not save your review'))
      .finally(() => setSaving(false));
  };

  const remove = (id) => {
    API.delete(`/reviews/${id}`)
      .then(() => { load(); onChanged?.(); })
      .catch((err) => setError(err.response?.data?.message || 'Could not remove review'));
  };

  const pct = (n) => (summary.count ? Math.round((n / summary.count) * 100) : 0);

  return (
    <section className="pdp-block" id="reviews">
      <h2><MessageSquare size={18} aria-hidden="true" /> Ratings &amp; reviews</h2>

      <div className="review-summary">
        <div className="review-avg">
          <span className="review-avg-num">{summary.average || '0.0'}</span>
          <Stars value={summary.average} size={17} />
          <span className="muted">{summary.count} review{summary.count === 1 ? '' : 's'}</span>
        </div>
        <div className="review-bars">
          {(summary.breakdown || []).map((b) => (
            <div className="review-bar-row" key={b.star}>
              <span className="review-bar-star">{b.star} <Star size={11} fill="currentColor" aria-hidden="true" /></span>
              <span className="review-bar-track"><span className="review-bar-fill" style={{ width: `${pct(b.count)}%` }} /></span>
              <span className="review-bar-count">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* write a review */}
      {user ? (
        <form className="review-form" onSubmit={submit}>
          <div className="review-form-head">
            <strong>{mine ? 'Update your review' : 'Write a review'}</strong>
            <div className="star-picker" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star`}
                  onClick={() => setRating(n)} className="star-pick-btn">
                  <Star size={22} aria-hidden="true" fill={n <= rating ? 'currentColor' : 'none'}
                    className={n <= rating ? 'star-on' : 'star-off'} />
                </button>
              ))}
            </div>
          </div>
          <textarea rows="3" maxLength="800" placeholder="Share what you liked about this product…"
            value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? <><LoaderCircle size={15} className="spin" aria-hidden="true" /> Saving…</> : mine ? 'Update review' : 'Submit review'}
          </button>
        </form>
      ) : (
        <p className="review-login-hint">
          <a href="/login" className="shop-link">Log in</a> to rate and review this product.
        </p>
      )}

      {/* list */}
      {loading ? (
        <p className="loading-shimmer">Loading reviews</p>
      ) : reviews.length === 0 ? (
        <p className="empty">No reviews yet — be the first to review this product.</p>
      ) : (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r._id} className="review-item">
              <span className="review-avatar">{initials(r.name)}</span>
              <div className="review-body">
                <div className="review-meta">
                  <strong>{r.name}</strong>
                  {r.verified && <span className="verified-chip"><BadgeCheck size={13} aria-hidden="true" /> Verified purchase</span>}
                  <span className="muted">· {when(r.createdAt)}</span>
                </div>
                <Stars value={r.rating} size={13} />
                {r.comment && <p className="review-text">{r.comment}</p>}
              </div>
              {(user && (r.user === user._id || user.role === 'admin')) && (
                <button type="button" className="review-del" onClick={() => remove(r._id)} aria-label="Delete review">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}