// The shop's public username: a slug of the shop name so the merchant gets a
// solid identity (onlinekirana.com/shop/new-mithai-bhatti) instead of a random
// Mongo id. On a collision, a short numeric suffix is appended.
const slugifyShop = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '');

/** Unique username from the shop name, skipping the merchant's own document. */
const uniqueShopUsername = async (User, base, currentUserId) => {
  const clean = slugifyShop(base) || 'shop';
  let candidate = clean;
  for (let n = 2; n < 50; n += 1) {
    // eslint-disable-next-line no-await-in-loop
    const taken = await User.findOne({ shopUsername: candidate, _id: { $ne: currentUserId } }).select('_id').lean();
    if (!taken) return candidate;
    candidate = `${clean}-${n}`;
  }
  return `${clean}-${Date.now().toString(36)}`;
};

module.exports = { slugifyShop, uniqueShopUsername };
