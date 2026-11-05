const PILOT_DELIVERY_ENABLED = process.env.PILOT_DELIVERY_ENABLED === 'true';
const PILOT_CANCELLATION_ENABLED = process.env.PILOT_CANCELLATION_ENABLED === 'true';
const NIGHT_RATE_PER_KM = 10;
const CANCELLATION_WINDOW_DAYS = 30;
const CANCELLATION_LIMIT = 3;
const CANCELLATION_RESTRICTION_DAYS = 7;

const LEGACY_SLOTS = [
  { key: 'today-evening', label: 'Today, 4–7 pm', cutoffHour: 15 },
  { key: 'today-night', label: 'Today, 7–10 pm', cutoffHour: 19 },
  { key: 'tomorrow-morning', label: 'Tomorrow, 8–11 am', cutoffHour: 24 },
  { key: 'tomorrow-evening', label: 'Tomorrow, 4–7 pm', cutoffHour: 24 },
];
const LEGACY_LABELS = Object.fromEntries(LEGACY_SLOTS.map(({ key, label }) => [key, label]));

const PILOT_SLOTS = [
  { key: 'pilot-today-evening', label: 'Today · Free', feeMode: 'free' },
  { key: 'pilot-tomorrow-evening', label: 'Tomorrow · Free', feeMode: 'free' },
];

const SLOTS = PILOT_DELIVERY_ENABLED ? PILOT_SLOTS : LEGACY_SLOTS;
const DEFAULT_SLOT = SLOTS[0];
const slotByKey = (key) => SLOTS.find((slot) => slot.key === key) || null;
const slotLabel = (key) => slotByKey(key)?.label || LEGACY_LABELS[key] || 'Standard delivery';

function birgunjParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu', hour: '2-digit', hourCycle: 'h23', minute: '2-digit',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { hour: get('hour'), minute: get('minute') };
}

// Average time between a customer placing an order and it reaching their door.
const AVG_FULFILMENT_MINUTES = 180;
// Delivery windows for the storefront (5 am opening, 10 pm closing).
const OPEN_HOUR = 5;
const CLOSE_HOUR = 22;

/** Birgunj wall-clock time as minutes since midnight. */
const birgunjMinutes = (now = new Date()) => birgunjParts(now).hour * 60 + birgunjParts(now).minute;

/**
 * Build the concrete windows a customer can actually be promised right now.
 *
 * The promise starts once the average fulfilment time (3 hours) has passed.
 * A window must open no earlier than that and close no later than 10 pm Birgunj
 * time; a same-day window that cannot fit is dropped, so an order placed at
 * 8 pm jumps straight to tomorrow's window instead of showing an impossible
 * "tonight" promise.
 *
 * Night delivery is not offered yet: the paid late-night window is hidden.
 */
function availableSlots(now = new Date(), { riderOnline = false, distanceKm = null } = {}) {
  if (!PILOT_DELIVERY_ENABLED) {
    const hour = birgunjParts(now).hour;
    return SLOTS.filter((slot) => slot.cutoffHour === 24 || hour < slot.cutoffHour);
  }
  const readyAt = birgunjMinutes(now) + AVG_FULFILMENT_MINUTES;
  const closeAt = CLOSE_HOUR * 60;
  const windows = [
    { key: 'pilot-today-evening', day: 'Today' },
    { key: 'pilot-tomorrow-evening', day: 'Tomorrow' },
  ];
  return windows
    .map(({ key, day }) => {
      const start = key === 'pilot-today-evening' ? Math.max(OPEN_HOUR * 60, readyAt) : OPEN_HOUR * 60;
      const finish = Math.min(closeAt, start + 3 * 60);
      if (finish <= start) return null;
      const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      return { key, label: `${day}, ${fmt(start)}–${fmt(finish)} · Free`, feeMode: 'free' };
    })
    .filter(Boolean);
}

function feeForSlot(slotKey, distanceKm) {
  const slot = slotByKey(slotKey);
  if (!slot) return null;
  if (slot.feeMode !== 'night') return 0;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  // Charge each started kilometer: 0.4 km = रू10, 1.2 km = रू20.
  return Math.ceil(distanceKm) * NIGHT_RATE_PER_KM;
}

// Straight-line estimate for the pilot. A routing provider is needed before
// presenting this as road distance or using it as a final commercial quote.
function distanceKm(from, to) {
  const valid = (point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) &&
    Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;
  if (!valid(from) || !valid(to)) return null;
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(Number(to.lat) - Number(from.lat));
  const dLng = rad(Number(to.lng) - Number(from.lng));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(from.lat))) * Math.cos(rad(Number(to.lat))) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

module.exports = {
  PILOT_DELIVERY_ENABLED,
  PILOT_CANCELLATION_ENABLED,
  NIGHT_RATE_PER_KM,
  CANCELLATION_WINDOW_DAYS,
  CANCELLATION_LIMIT,
  CANCELLATION_RESTRICTION_DAYS,
  SLOTS,
  DEFAULT_SLOT,
  slotByKey,
  slotLabel,
  availableSlots,
  feeForSlot,
  distanceKm,
};
