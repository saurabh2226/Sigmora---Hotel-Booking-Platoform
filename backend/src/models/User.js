const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phone: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'owner', 'admin', 'superadmin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    emailOtpHash: {
      type: String,
    },
    emailOtpExpires: {
      type: Date,
    },
    emailOtpPurpose: {
      type: String,
      enum: ['verify-email', 'reset-password'],
    },
    passwordResetSessionToken: {
      type: String,
    },
    passwordResetSessionExpires: {
      type: Date,
    },
    verificationToken: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },
    preferences: {
      currency: { type: String, default: 'INR' },
      notifications: { type: Boolean, default: true },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    },
  },
  { timestamps: true }
);

// Indexes (email unique index is already created by 'unique: true' on the field)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.emailOtpHash;
  delete obj.emailOtpExpires;
  delete obj.emailOtpPurpose;
  delete obj.passwordResetSessionToken;
  delete obj.passwordResetSessionExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.verificationToken;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
