import { useRef, useState } from 'react';

const SEEN_KEY = 'ok_beta_notice_seen_v1';

/**
 * Popup disclaimer showing the official "Public Notice & Beta Service
 * Announcement" for the beta phase. It renders the uploaded notice image
 * (/notice.png). Save the notice document image at client/public/notice.png
 * to display it; until then a styled text version of the same notice is
 * shown as a fallback. A Close button (and clicking the backdrop) dismisses
 * it for the rest of the browser session (localStorage flag).
 */
export default function BetaNoticeModal() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [imgFailed, setImgFailed] = useState(false);

  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode — just close */
    }
    setOpen(false);
  };

  return (
    <div
      className="beta-notice-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Public Notice & Beta Service Announcement"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="beta-notice-card">
        <button
          type="button"
          className="beta-notice-close"
          aria-label="Close notice"
          onClick={close}
        >
          ✕
        </button>

        {!imgFailed ? (
          <ZoomableNotice onFail={() => setImgFailed(true)} />
        ) : (
          <div className="beta-notice-text">
            <h2>Public Notice &amp; Beta Service Announcement</h2>
            <p>
              <strong>Online Kirana</strong> is officially entering its
              controlled <strong>Beta Testing Phase (Nov 1 – Dec 31, 2026)</strong>,
              operating at onlinekiranabirgunj.vercel.app.
            </p>
            <p>
              Official commercial launch: <strong>January 1, 2027</strong> on
              onlinekiranabirgunj.com.np. All accounts and histories migrate
              automatically.
            </p>
            <ol>
              <li>
                <strong>Direct Merchant QR Payments:</strong> digital payments go
                directly to the merchant&apos;s QR account — the platform does not
                hold or escrow funds.
              </li>
              <li>
                <strong>Refund-style Direct Settlement:</strong> in the unlikely
                event a paid order is cancelled, lost or refunded, the refund is
                settled back the same way it went out — the merchant refunds
                through the same channel the customer paid
                (merchant <span className="nowrap">QR / Cash-on-Delivery</span> cash —
                never a platform-held balance). The platform facilitates and
                tracks every settlement until it reaches your hands.
              </li>
              <li>
                <strong>Cash-on-Delivery:</strong> cash is collected by the rider
                and transferred directly to the fulfilling merchant.
              </li>
              <li>
                <strong>Mandatory Delivery OTP:</strong> inspect your items and
                complete payment before sharing your OTP. Riders cannot mark an
                order Delivered/Returned without it.
              </li>
            </ol>
            <p className="beta-notice-sign">
              — Dirghraj Giri, Founder &amp; Developer, Online Kirana Pvt. Ltd.,
              Birgunj
            </p>
          </div>
        )}

        <button type="button" className="beta-notice-accept" onClick={close}>
          I Understand — Continue
        </button>
      </div>
    </div>
  );
}

/**
 * The notice is a long legal document scan — at card width the text is too
 * small to read. A zoomable viewer (wheel / pinch / double-tap, drag to pan)
 * lets people actually read it without leaving the modal.
 */
function ZoomableNotice({ onFail }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);

  const clampScale = (s) => Math.min(5, Math.max(1, s));

  const zoomAt = (factor, cx, cy) =>
    setScale((prev) => {
      const next = clampScale(prev * factor);
      const k = next / prev;
      setOffset((o) => ({
        x: cx - (cx - o.x) * k,
        y: cy - (cy - o.y) * k,
      }));
      return next;
    });

  const onWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragging || !dragStart.current) return;
    setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const endDrag = () => setDragging(false);

  // Two-pointer pinch: track the distance between the touches.
  const pinch = useRef(null);
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setScale(clampScale((pinch.current.scale * dist) / pinch.current.dist));
    }
  };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="notice-zoom-wrap">
      <div
        className={`notice-zoom-viewport${dragging ? ' is-dragging' : ''}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onDoubleClick={reset}
        role="img"
        aria-label="Online Kirana — Public Notice & Beta Service Announcement (zoomable document)"
      >
        <img
          src="/notice.png"
          alt=""
          draggable="false"
          className="notice-zoom-image"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          onError={onFail}
        />
      </div>
      <div className="notice-zoom-controls">
        <button
          type="button"
          className="notice-zoom-btn"
          aria-label="Zoom out"
          onClick={() => zoomAt(1 / 1.25, 0, 0)}
        >
          −
        </button>
        <span className="notice-zoom-level" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className="notice-zoom-btn"
          aria-label="Zoom in"
          onClick={() => zoomAt(1.25, 0, 0)}
        >
          +
        </button>
        <button
          type="button"
          className="notice-zoom-btn notice-zoom-reset"
          onClick={reset}
        >
          Reset
        </button>
      </div>
      <p className="notice-zoom-hint">Scroll or pinch to zoom · drag to pan · double-tap to reset</p>
    </div>
  );
}
