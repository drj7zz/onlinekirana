 
   /**
 * Background task worker (drained via Redis queue — see lib/platform).
 *
 * Started once at boot. Tasks:
 *   order-packed  — notify the customer that the shop packed their order
 *   notify-riders — tell every eligible on-shift rider a job is open
 *
 * Handlers are idempotent: the queue is at-least-once, so a re-run may send a
 * duplicate notification in the rare crash-between-send-and-ack window.
 */
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const deliveryController = require('../controllers/deliveryController');
const { notifyUsers } = require('../utils/notifications');

async function handle(task) {
  switch (task.type) {
    case 'order-packed': {
      if (!task.orderId) return;
      await notifyUsers([task.orderUser].filter(Boolean), {
        type: 'order',
        title: 'Order packed',
        body: 'The shop packed your items. A rider will accept the delivery next.',
        link: '/orders',
      }).catch(() => { });
      return;
    }
    case 'notify-riders': {
      if (!task.deliveryId) return;
      const delivery = await Delivery.findById(task.deliveryId).select('dropoff fee');
      if (!delivery) return;
      const [riders, loads] = await Promise.all([
        User.find({ role: 'delivery', riderStatus: { $in: ['available', 'on_delivery'] } }).select('_id').lean(),
        Delivery.aggregate([
          { $match: { status: { $in: ['assigned', 'accepted', 'picked'] } } },
          { $group: { _id: '$rider', count: { $sum: 1 } } },
        ]),
      ]);
      const active = new Map(loads.map((row) => [String(row._id), row.count]));
      const eligible = riders
        .filter((rider) => (active.get(String(rider._id)) || 0) < deliveryController.MAX_ACTIVE_JOBS)
        .map((rider) => rider._id);
      await notifyUsers(eligible, {
        type: 'delivery',
        title: 'Delivery available',
        body: `A packed order is ready to accept${delivery.dropoff?.ward ? ` · Ward ${delivery.dropoff.ward}` : ''}${delivery.fee ? ` · Late delivery charge रू ${delivery.fee}` : ' · Free evening delivery'}.`,
        link: '/rider',
      }).catch(() => { });
      return;
    }
    default:
      console.warn('[queue] unknown task type:', task.type);
  }
}

module.exports = { handle };
