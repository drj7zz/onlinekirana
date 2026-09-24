const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true },
  address: {
    line: String,
    city: { type: String, default: 'Birgunj' },
    ward: String,
  },
  avatarUrl: { type: String, default: '' },
  role: { type: String, enum: ['customer', 'merchant', 'admin'], default: 'customer' },
  // merchant (partner) fields — only used when role === 'merchant'
  shopName: { type: String, trim: true },
  merchantStatus: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
  // public shop page profile (merchant only)
  shopDescription: { type: String, trim: true, default: '', maxlength: 600 },
  shopPhone: { type: String, trim: true, default: '' },
  shopLogoUrl: { type: String, trim: true, default: '' },
  shopAddress: {
    line: { type: String, trim: true, default: '' },
    ward: { type: String, trim: true, default: '' },
    city: { type: String, default: 'Birgunj' },
  },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
