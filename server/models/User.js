const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Kept as a soft legacy flag: historical accounts recorded completion of the
  // temporary in-app code step here. New accounts are simply verified on create.
  emailVerified: { type: Boolean, default: true },
  passwordless: { type: Boolean, default: false },
  password: { type: String, required() { return !this.passwordless; }, minlength: 6 },
  googleSub: { type: String, select: false },
  phone: { type: String, trim: true },
  address: {
    line: String,
    city: { type: String, default: 'Birgunj' },
    ward: String,
    location: { lat: Number, lng: Number },
  },
  avatarUrl: { type: String, default: '' },
  // 'delivery' riders are staff of the delivery desk, not shop owners
  role: { type: String, enum: ['customer', 'merchant', 'delivery', 'admin'], default: 'customer' },
  // delivery rider (partner) fields — only used when role === 'delivery'
  // A rider is onboarded pending, then an admin marks them available.
  riderArea: { type: String, trim: true, default: '' },       // home ward / area they cover
  riderStatus: { type: String, enum: ['pending', 'available', 'on_delivery', 'offline', 'suspended'], default: 'pending' },
  riderVehicle: { type: String, trim: true, default: '' },     // e.g. "Bike", "Cycle", "E-cargo"
  // merchant (partner) fields — only used when role === 'merchant'
  shopName: { type: String, trim: true },
  // Public, human-readable handle derived from the shop name — a customer can
  // visit /shop/:username style links, and the merchant has a solid identity
  // instead of a random Mongo id. Kept unique and lower-case.
  shopUsername: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  // Optional public Google Maps link to the shop's own listing.
  shopGoogleMapsUrl: { type: String, trim: true, default: '' },
  merchantStatus: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
  // public shop page profile (merchant only)
  shopDescription: { type: String, trim: true, default: '', maxlength: 600 },
  shopPhone: { type: String, trim: true, default: '' },
  shopLogoUrl: { type: String, trim: true, default: '' },
  shopAddress: {
    line: { type: String, trim: true, default: '' },
    ward: { type: String, trim: true, default: '' },
    city: { type: String, default: 'Birgunj' },
    location: { lat: Number, lng: Number },
  },
  orderRestrictedUntil: { type: Date, default: null },
  // saved-for-later product ids (customer wishlist)
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  pushSubscriptions: {
    type: [{
      endpoint: { type: String, trim: true },
      keys: {
        p256dh: { type: String, trim: true },
        auth: { type: String, trim: true },
      },
    }],
    default: [],
    select: false,
  },
}, { timestamps: true });

userSchema.index({ role: 1, merchantStatus: 1 });
userSchema.index({ role: 1, riderStatus: 1 });
userSchema.index({ googleSub: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return this.password ? bcrypt.compare(plain, this.password) : false;
};

module.exports = mongoose.model('User', userSchema);
