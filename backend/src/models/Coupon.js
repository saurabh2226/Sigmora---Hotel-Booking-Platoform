const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    bannerText: {
      type: String,
      trim: true,
      maxlength: [120, 'Banner text cannot exceed 120 characters'],
      default: '',
    },
    bannerColor: {
      type: String,
      trim: true,
      default: '#0f766e',
    },
    scope: {
      type: String,
      enum: ['global', 'hotel'],
      default: 'global',
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    priority: {
      type: Number,
      default: 0,
    },
    minBookingAmount: {
      type: Number,
      default: 0,
    },
    maxDiscount: {
      type: Number,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    usageLimit: {
      type: Number,
      default: 100,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// code unique index is already created by 'unique: true' on the field
couponSchema.index({ isActive: 1, validUntil: 1 });
couponSchema.index({ hotel: 1, isActive: 1, validUntil: 1 });

couponSchema.pre('validate', function (next) {
  if (this.hotel) {
    this.scope = 'hotel';
  } else {
    this.scope = 'global';
  }

  if (this.scope === 'hotel' && !this.hotel) {
    this.invalidate('hotel', 'Hotel-specific offers must be linked to a hotel');
  }

  if (!this.title) {
    this.title = `${this.code} Offer`;
  }

  if (!this.bannerText) {
    const amount = this.discountType === 'percentage' ? `${this.discountValue}% OFF` : `Save ₹${this.discountValue}`;
    this.bannerText = `${amount} with code ${this.code}`;
  }

  next();
});

// Method: check if coupon is valid
couponSchema.methods.isValid = function () {
  const now = new Date();
  return (
    this.isActive &&
    this.usedCount < this.usageLimit &&
    (!this.validFrom || now >= this.validFrom) &&
    (!this.validUntil || now <= this.validUntil)
  );
};

// Method: calculate discount
couponSchema.methods.calculateDiscount = function (amount) {
  if (!this.isValid()) return 0;
  if (amount < this.minBookingAmount) return 0;

  let discount;
  if (this.discountType === 'percentage') {
    discount = (amount * this.discountValue) / 100;
    if (this.maxDiscount) {
      discount = Math.min(discount, this.maxDiscount);
    }
  } else {
    discount = this.discountValue;
  }

  return Math.round(discount * 100) / 100;
};

module.exports = mongoose.model('Coupon', couponSchema);
