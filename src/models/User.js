const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'USA' },
  isDefault: { type: Boolean, default: false }
});

const deviceSchema = new mongoose.Schema({
  deviceId: String,
  userAgent: String,
  ip: String,
  lastUsed: Date,
  verified: { type: Boolean, default: false }
}, { _id: false });

const ipSchema = new mongoose.Schema({
  address: String,
  userAgent: String,
  firstSeen: Date,
  lastUsed: Date
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: [true, 'First name is required'] },
  lastName: { type: String, required: [true, 'Last name is required'] },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  phone: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  avatar: { type: String },
  addresses: [addressSchema],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  
  // Email verification fields (for 6-digit code)
  verificationCode: String,
  verificationCodeExpire: Date,
  
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordTokenExpire: Date,
  
  // Login security fields
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  
  // Last login info
  lastLoginIp: String,
  lastLoginDevice: String,
  lastLoginAt: Date,
  
  // IP-based verification fields
  knownIps: [ipSchema],
  loginVerificationCode: String,
  loginVerificationCodeExpire: Date,
  pendingLoginIp: String,
  pendingLoginUserAgent: String
  
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If lock has expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // Lock for 30 minutes
  }
  
  return this.updateOne(updates);
};

module.exports = mongoose.model('User', userSchema);