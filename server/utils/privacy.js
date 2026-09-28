/**
 * Privacy helpers for the dispatch desk.
 *
 * Admins supervise the flow, they do not need to read everybody's phone number
 * in full. Numbers are masked by default; the API returns the last two digits
 * only, which is enough to tell two riders apart and nothing more. The full
 * number still reaches the assigned rider, because they must actually call the
 * customer to hand the goods over.
 */

/** Keep the last `keep` digits, replace the rest with a dot run. */
const maskPhone = (value, keep = 2) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= keep) return '*'.repeat(digits.length);
  return `${'*'.repeat(Math.min(digits.length - keep, 4))}${digits.slice(-keep)}`;
};

/** Mask a delivery's dropoff/pickup contact for an admin-facing payload. */
const maskContact = (contact) => {
  if (!contact) return contact;
  return { ...contact, phone: maskPhone(contact.phone) };
};

/** Mask both ends of a delivery document. */
const maskDelivery = (job) => {
  if (!job || !job.toObject) return job;
  const plain = job.toObject();
  return {
    ...plain,
    otp: undefined, // the hand-over code belongs to the customer and the rider
    pickup: maskContact(plain.pickup),
    dropoff: maskContact(plain.dropoff),
  };
};

module.exports = { maskPhone, maskContact, maskDelivery };
