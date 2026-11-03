import { useState } from 'react';

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
          <img
            src="/notice.png"
            alt="Online Kirana — Public Notice & Beta Service Announcement"
            className="beta-notice-image"
            onError={() => setImgFailed(true)}
          />
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
