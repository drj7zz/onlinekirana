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
  { key: 'pilot-today-evening', label: 'Today, 5 am–10 pm · Free', cutoffHour: 22, feeMode: 'free' },
  { key: 'pilot-today-late', label: 'Tonight, 10 pm–12 am · Paid', cutoffHour: 22, feeMode: 'night' },
  { key: 'pilot-tomorrow-evening', label: 'Tomorrow, 5 am–10 pm · Free', cutoffHour: 24, feeMode: 'free' },
  { key: 'pilot-tomorrow-late', label: 'Tomorrow, 10 pm–12 am · Paid', cutoffHour: 24, feeMode: 'night' },
];

const SLOTS = PILOT_DELIVERY_ENABLED ? PILOT_SLOTS : LEGACY_SLOTS;
const DEFAULT_SLOT = SLOTS[0];
const slotByKey = (key) => SLOTS.find((slot) => slot.key === key) || null;
const slotLabel = (key) => slotByKey(key)?.label || LEGACY_LABELS[key] || 'Standard delivery';

function birgunjHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
}

function availableSlots(now = new Date(), { riderOnline = false, distanceKm = null } = {}) {
  const hour = birgunjHour(now);
  const slots = SLOTS.filter((slot) => slot.cutoffHour === 24 || hour < slot.cutoffHour);
  if (!PILOT_DELIVERY_ENABLED) return slots;
  return slots.filter((slot) => slot.feeMode !== 'night' || (riderOnline && Number.isFinite(distanceKm) && distanceKm > 0));
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
