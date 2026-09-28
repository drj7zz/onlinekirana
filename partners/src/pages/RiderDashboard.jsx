import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike, MapPin, Phone, PackageOpen, KeyRound, CircleCheck,
  Power, Navigation, PackageCheck, Store, Clock,
} from 'lucide-react';
import API from '@shared/api';
import { useAuth } from '@shared/context/AuthContext';
import { useLive } from '@shared/hooks/useLive';
import ImageUpload from '@shared/components/ImageUpload';
import { DELIVERY_LABEL, DELIVERY_STEPS, money, timeAgo } from '@shared/lib/delivery';

/** What a rider can do at each step, in their own words. */
const NEXT_ACTIONS = {
  // Arriving at the counter is the merchant hand-over moment: the shop sees the
  // rider's name and phone, and the rider confirms they are physically there.
  assigned: { key: 'accepted', label: "I've reached the shop", icon: Navigation },
  accepted: { key: 'picked', label: 'Goods collected', icon: PackageCheck },
  picked: { key: 'delivered', label: 'Handed over', icon: CircleCheck },
};

/** Small stepper so the rider always knows how far through the job they are. */
function StepBar({ status }) {
  if (status === 'failed') {
    return <p className="job-failed">This delivery could not be completed. The team has been notified.</p>;
  }
  const current = DELIVERY_STEPS.indexOf(status);
  return (
    <ol className="job-steps" aria-label={`Delivery progress: ${DELIVERY_LABEL[status]}`}>
      {DELIVERY_STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'current' : 'todo'}>
          <span className="job-dot" />
          <span>{DELIVERY_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}

/** One job. Carries the OTP prompt on the final step. */
function JobCard({ job, onAdvance, onClaim }) {
  const [otp, setOtp] = useState('');
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const action = NEXT_ACTIONS[job.status];
  const isOpen = job.status === 'pending' && !job.rider;
  const drop = job.dropoff || {};
  const pick = job.pickup || {};
  const order = job.order || {};

  const run = async (payload) => {
    setBusy(true);
    setErr('');
    try {
      await onAdvance(job._id, payload);
      setOtp(''); setProof('');
    } catch (e) {
      setErr(e.response?.data?.message || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="order-card job-card">
      <header className="order-head">
        <div className="order-head-main">
          <span className={`status s-${job.status}`}>{DELIVERY_LABEL[job.status]}</span>
          <span className="muted">queued {timeAgo(job.createdAt)}</span>
        </div>
        <div className="order-head-side">
          <strong className="order-total">{money(job.fee)}</strong>
          {isOpen && <button onClick={() => onClaim(job._id)} disabled={busy}>Take this job</button>}
        </div>
      </header>

      <StepBar status={job.status} />

      {/* a one-line instruction for the step this rider is actually on */}
      {job.status === 'assigned' && (
        <p className="job-otp-help" style={{ marginBottom: '.6rem' }}>
          <Store size={14} aria-hidden="true" /> Head to {pick.shopName || 'the counter'} and tap the button below once you are there. The shop is waiting to hand the goods over.
        </p>
      )}
      {job.status === 'accepted' && (
        <p className="job-otp-help" style={{ marginBottom: '.6rem' }}>
          <PackageCheck size={14} aria-hidden="true" /> Take the goods from {pick.shopName || 'the counter'}, then confirm below.
        </p>
      )}

      {/* where to go, in order: shop first, then the customer */}
      <div className="job-route">
        <div className="job-leg">
          <span className="job-leg-icon"><Store size={15} aria-hidden="true" /></span>
          <div>
            <span className="job-leg-label">Collect from</span>
            <strong>{pick.shopName || 'OnlineKirana counter'}</strong>
            <span className="muted">{[pick.line, pick.ward && `Ward ${pick.ward}`].filter(Boolean).join(', ') || 'Main counter'}</span>
            {pick.phone && <a className="job-phone" href={`tel:${pick.phone}`}><Phone size={12} aria-hidden="true" /> {pick.phone}</a>}
          </div>
        </div>
        <div className="job-leg">
          <span className="job-leg-icon drop"><MapPin size={15} aria-hidden="true" /></span>
          <div>
            <span className="job-leg-label">Deliver to</span>
            <strong>{drop.name || 'Customer'}</strong>
            <span className="muted">{[drop.line, drop.ward && `Ward ${drop.ward}`].filter(Boolean).join(', ')}, Birgunj</span>
            {drop.phone && <a className="job-phone" href={`tel:${drop.phone}`}><Phone size={12} aria-hidden="true" /> {drop.phone}</a>}
          </div>
        </div>
      </div>

      {job.slot && <p className="job-slot">Promised: {job.slot}</p>}
      {job.instructions && <p className="order-note"><strong>Customer note:</strong> {job.instructions}</p>}

      {(order.items || []).length > 0 && (
        <div className="order-items">
          <div className="order-items-head">
            <span><PackageOpen size={14} aria-hidden="true" /> {order.items.length} item(s) to collect</span>
          </div>
          <ul>
            {order.items.map((i, idx) => (
              <li key={idx}>
                <span className="oi-name">{i.name}</span>
                <span className="oi-qty">{i.qty} {i.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* the only manual step: prove the hand-over with the customer's code */}
      {action?.key === 'delivered' && (
        <div className="job-otp">
          <p className="job-otp-help">
            <KeyRound size={14} aria-hidden="true" /> Ask the customer to read out their 4-digit hand-over code.
          </p>
          <input
            inputMode="numeric"
            maxLength={4}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="····"
            aria-label="Hand-over code from the customer"
          />
          <label>Photo of the drop-off (optional)</label>
          <ImageUpload endpoint="/uploads/product" value={proof} size={72}
            label="Add photo" onChange={setProof} />
        </div>
      )}

      {err && <p className="error">{err}</p>}

      {action && (
        <div className="job-actions">
          <button
            className="cta-btn"
            disabled={busy || (action.key === 'delivered' && otp.length !== 4)}
            onClick={() => run({
              status: action.key,
              otp: otp || undefined,
              proofImageUrl: proof || undefined,
            })}
          >
            <action.icon size={16} aria-hidden="true" /> {action.label}
          </button>
          {job.status !== 'picked' && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                const reason = prompt('Why could this not be delivered?');
                if (reason) run({ status: 'failed', note: reason });
              }}
            >
              Can&apos;t deliver
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function RiderDashboard() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState({ mine: [], open: [] });
  const [online, setOnline] = useState(user?.riderStatus === 'available' || user?.riderStatus === 'on_delivery');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = () => API.get('/delivery/jobs')
    .then(({ data: d }) => setData({ mine: d.mine || [], open: d.open || [] }))
    .catch(() => setMsg('We could not load your jobs right now.'))
    .finally(() => setLoading(false));

  useLive(load, 7000, [user?._id]);

  const toggleShift = async () => {
    const next = !online;
    setOnline(next);
    try {
      await API.post('/delivery/availability', { online: next });
      setMsg(next ? 'You are online. New jobs will show up here.' : 'You are off shift.');
    } catch (e) {
      setOnline(!next);
      setMsg(e.response?.data?.message || 'Could not change your shift.');
      // The server is the authority on shift state — an approval granted since
      // sign-in would still be showing the stale value from the stored session.
      if (e.response?.status === 403) refresh(API);
    }
  };

  const claim = async (id) => {
    try {
      await API.post(`/delivery/jobs/${id}/claim`);
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Someone else took that job.');
    }
  };

  const advance = async (id, payload) => {
    await API.patch(`/delivery/jobs/${id}`, payload);
    load();
  };

  if (!user) return <p className="empty">Please <Link to="/login">sign in</Link> to start delivering.</p>;
  if (user.role !== 'delivery') {
    return <p className="empty">This is the delivery partner area. Your account can still <Link to="/dashboard">go to your dashboard</Link>.</p>;
  }

  // A rider who signed up but has not been approved yet has no shift to work.
  // Say so and stop, rather than showing a toggle the API will reject.
  if (user.riderStatus === 'pending') {
    return (
      <div className="gate">
        <span className="gate-icon"><Clock size={28} aria-hidden="true" /></span>
        <h1>Waiting for approval</h1>
        <p>
          Your rider account is created and with the operations desk now, Namaste {user.name.split(' ')[0]}.
          As soon as it is approved you can go on shift and start taking jobs.
        </p>
        <div className="gate-actions">
          <Link className="cta-btn" to="/pending">See what happens next</Link>
        </div>
        <p className="gate-hint">No documents are needed at any point.</p>
      </div>
    );
  }

  const active = data.mine.filter((j) => j.status !== 'delivered' && j.status !== 'failed');
  const done = data.mine.filter((j) => j.status === 'delivered');
  const earned = done.reduce((s, j) => s + Number(j.fee || 0), 0);

  return (
    <div>
      <h1>Namaste, {user.name.split(' ')[0]}!</h1>
      <p className="muted">
        <Bike size={14} aria-hidden="true" /> {user.riderVehicle || 'Rider'}
        {user.riderArea && ` · ${user.riderArea}`}
      </p>

      <div className="shift-bar">
        <button className={online ? 'cta-btn' : 'muted-btn'} onClick={toggleShift} disabled={user.riderStatus === 'suspended'}>
          <Power size={16} aria-hidden="true" /> {online ? 'Go off shift' : 'Go on shift'}
        </button>
        {user.riderStatus === 'suspended' && <span className="muted">Your account is suspended — contact the admin.</span>}
      </div>

      {msg && <p className="muted">{msg}</p>}

      <div className="stat-grid">
        <div className="stat-card accent"><div className="stat-value">{active.length}</div><div className="stat-label">Active jobs</div></div>
        <div className="stat-card"><div className="stat-value">{data.open.length}</div><div className="stat-label">Open nearby</div></div>
        <div className="stat-card"><div className="stat-value">{done.length}</div><div className="stat-label">Delivered</div></div>
        <div className="stat-card"><div className="stat-value">{money(earned)}</div><div className="stat-label">Delivery fees earned</div></div>
      </div>

      {loading ? (
        <p className="loading-shimmer">Loading your jobs</p>
      ) : (
        <>
          <h2>Your jobs</h2>
          {active.length === 0 ? (
            <div className="empty-state">
              <PackageOpen size={34} aria-hidden="true" />
              <p>Nothing in hand right now. {online ? 'Open jobs below are yours to take.' : 'Go on shift to see open jobs.'}</p>
            </div>
          ) : (
            <div className="order-list">
              {active.map((j) => <JobCard key={j._id} job={j} onAdvance={advance} onClaim={claim} />)}
            </div>
          )}

          {data.open.length > 0 && (
            <>
              <h2>Open jobs</h2>
              <p className="muted">First to take it gets it.</p>
              <div className="order-list">
                {data.open.map((j) => <JobCard key={j._id} job={j} onAdvance={advance} onClaim={claim} />)}
              </div>
            </>
          )}

          {done.length > 0 && (
            <>
              <h2>Delivered</h2>
              <div className="order-list">
                {done.map((j) => <JobCard key={j._id} job={j} onAdvance={advance} onClaim={claim} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
