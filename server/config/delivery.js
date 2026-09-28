/**
 * Delivery rules for OnlineKirana.
 *
 * Everything a customer sees about delivery (fees, promised windows, the slots
 * they can choose at checkout) is defined here so pricing is never hard-coded
 * across the checkout page, the API and the delivery console.
 */

// Flat base fee, then a small per-ward surcharge, then free over the threshold.
const BASE_FEE = 30;
const WARD_SURCHARGE = { 1: 10, 2: 20, 3: 20, 4: 30, 5: 30, 6: 40, 7: 40, 8: 50, 9: 50 };
const DEFAULT_SURCHARGE = 60;
const FREE_OVER = 1500;

/**
 * Charge for a ward number. Unknown/blank wards fall back to the highest
 * surcharge so a mistyped ward can never under-quote the rider.
 */
function feeForWard(ward) {
  const n = parseInt(ward, 10);
  const surcharge = Object.prototype.hasOwnProperty.call(WARD_SURCHARGE, n) ? WARD_SURCHARGE[n] : DEFAULT_SURCHARGE;
  return BASE_FEE + surcharge;
}

/** Delivery is free once the basket value reaches the threshold. */
function feeFor(basketTotal, ward) {
  if (Number(basketTotal) >= FREE_OVER) return 0;
  return feeForWard(ward);
}

// Promised windows, keyed by the slot key the client posts back.
const SLOTS = [
  { key: 'today-evening', label: 'Today, 4–7 pm', windowHours: 3, cutoffHour: 15 },
  { key: 'today-night', label: 'Today, 7–10 pm', windowHours: 3, cutoffHour: 19 },
  { key: 'tomorrow-morning', label: 'Tomorrow, 8–11 am', windowHours: 3, cutoffHour: 24 },
  { key: 'tomorrow-evening', label: 'Tomorrow, 4–7 pm', windowHours: 3, cutoffHour: 24 },
];
const DEFAULT_SLOT = SLOTS[0];

const slotByKey = (key) => SLOTS.find((s) => s.key === key) || null;

/** Human label for a stored slot key, falling back gracefully for old orders. */
const slotLabel = (key) => slotByKey(key)?.label || 'Standard delivery';

/**
 * Which slots can still be promised right now. A same-day slot disappears once
 * its cutoff hour has passed on the server clock (not the browser clock).
 */
function availableSlots(now = new Date()) {
  const hour = now.getHours();
  return SLOTS.filter((s) => s.cutoffHour === 24 || hour < s.cutoffHour);
}

module.exports = {
  BASE_FEE,
  WARD_SURCHARGE,
  DEFAULT_SURCHARGE,
  FREE_OVER,
  SLOTS,
  DEFAULT_SLOT,
  feeForWard,
  feeFor,
  slotByKey,
  slotLabel,
  availableSlots,
};
