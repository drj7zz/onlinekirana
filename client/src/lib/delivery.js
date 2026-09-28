    /**
 * Delivery vocabulary shared by every screen.
 *
 * The server owns the rules (fees, slot cut-offs) — this file only mirrors the
 * status names and labels the UI needs to render, so the timeline can never
 * drift from what the API accepts.
 */
import { ClipboardList, Check, PackageCheck, Bike, Home, XCircle, KeyRound, Clock, MapPin } from 'lucide-react';

/** Order timeline. `assigned` is new: a rider has picked the job up. */
export const ORDER_STEPS = [
  { key: 'pending', label: 'Placed', icon: ClipboardList, blurb: 'We received your order' },
  { key: 'confirmed', label: 'Confirmed', icon: Check, blurb: 'The shop accepted your order' },
  { key: 'packed', label: 'Packed', icon: PackageCheck, blurb: 'Your items are packed' },
  { key: 'assigned', label: 'Rider assigned', icon: Bike, blurb: 'A rider is coming to collect' },
  { key: 'out_for_delivery', label: 'On the way', icon: MapPin, blurb: 'Your order is on the move' },
  { key: 'delivered', label: 'Delivered', icon: Home, blurb: 'Handed over at your door' },
];

export const ORDER_STATUSES = ORDER_STEPS.map((s) => s.key).concat('cancelled');

export const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  packed: 'Packed',
  assigned: 'Rider assigned',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Delivery-job states, used by the rider and dispatch screens. */
export const DELIVERY_STEPS = ['pending', 'assigned', 'accepted', 'picked', 'delivered'];

export const DELIVERY_LABEL = {
  pending: 'Waiting for a rider',
  assigned: 'Rider assigned',
  accepted: 'Rider on the way to the shop',
  picked: 'Collected — on the way to you',
  delivered: 'Delivered',
  failed: 'Could not deliver',
};

export const DELIVERY_BLURB = {
  pending: 'We are lining up a rider for you',
  assigned: 'Your rider is getting ready to collect',
  accepted: 'Rider is heading to the shop now',
  picked: 'Rider has your order and is coming over',
  delivered: 'Enjoy!',
  failed: 'We are sorting this out for you',
};

export const RIDER_STATUS_LABEL = {
  pending: 'Pending approval',
  available: 'Available',
  on_delivery: 'On a delivery',
  offline: 'Off shift',
  suspended: 'Suspended',
};

export const RIDER_STATUS_TONE = {
  pending: 'warn',
  available: 'ok',
  on_delivery: 'busy',
  offline: 'muted',
  suspended: 'bad',
};

export const money = (n) => `रू ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const timeAgo = (d) => {
  if (!d) return '';
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export { KeyRound, Clock, Bike, XCircle, Home, Check, MapPin, PackageCheck, ClipboardList };
