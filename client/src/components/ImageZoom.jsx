import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';

/**
 * Full-size image lightbox for the product page.
 *
 * A shopper wants to see the actual sabzi before buying food — a 380px photo
 * does not carry that. The children (the thumbnail) become a button; tapping
 * opens the same URL full-screen in a portal, where the browser serves whatever
 * resolution was uploaded. Esc, the scrim or the ✕ closes it; background
 * scroll is locked while it is open.
 */
export default function ImageZoom({ src, alt = '', children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!src) return children; // nothing to zoom into — render the fallback as-is

  return (
    <>
      <button
        type="button"
        className="zoom-trigger"
        aria-label={`${alt ? `${alt} — ` : ''}view image full size`}
        onClick={() => setOpen(true)}
      >
        {children}
        <span className="zoom-hint"><Search size={13} aria-hidden="true" /> Tap to zoom</span>
      </button>
      {open && createPortal(
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt || 'Product image'} onClick={() => setOpen(false)}>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lightbox-x" aria-label="Close" onClick={() => setOpen(false)}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
