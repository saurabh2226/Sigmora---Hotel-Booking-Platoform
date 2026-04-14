const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel is required'],
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required'],
    },
    guests: {
      adults: { type: Number, min: 1, default: 1 },
      children: { type: Number, default: 0 },
    },
    guestDetails: {
      name: String,
      email: String,
      phone: String,
      checkInTime: String,
      checkOutTime: String,
      specialRequests: String,
    },
    pricing: {
      nightlyRate: Number,
      baseNightlyRate: Number,
      highestNightlyRate: Number,
      numberOfNights: Number,
      subtotal: Number,
      taxes: Number,        // 18% GST
      serviceFee: Number,   // 5% platform fee
      discount: { type: Number, default: 0 },
      couponCode: String,
      weekendNights: { type: Number, default: 0 },
      holidayNights: { type: Number, default: 0 },
      nightlyBreakdown: [
        {
          date: Date,
          baseRate: Number,
          adjustedRate: Number,
          tags: [String],
          holidayName: String,
        },
      ],
      totalPrice: Number,
    },
    holdExpiresAt: Date,
    payment: {
      method: {
        type: String,
        enum: ['razorpay'],
      },
      transactionId: String,
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'partial_refunded', 'refunded'],
        default: 'pending',
      },
      paidAt: Date,
      refundId: String,
      refundedAt: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'],
      default: 'pending',
    },
    cancelledAt: Date,
    cancellationReason: String,
    refundAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ hotel: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ 'payment.status': 1 });
bookingSchema.index({ holdExpiresAt: 1, status: 1 });

// Virtual for number of nights
bookingSchema.virtual('nights').get(function () {
  if (this.checkIn && this.checkOut) {
    const diffTime = Math.abs(this.checkOut - this.checkIn);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Pre-save: calculate pricing
bookingSchema.pre('save', function (next) {
  if (this.isModified('checkIn') || this.isModified('checkOut') || this.isModified('pricing.nightlyRate')) {
    const nights = Math.ceil(Math.abs(this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
    this.pricing.numberOfNights = nights;
    const calculatedSubtotal = Math.round(((this.pricing.subtotal ?? (this.pricing.nightlyRate * nights)) || 0) * 100) / 100;
    this.pricing.subtotal = calculatedSubtotal;
    this.pricing.taxes = Math.round(((this.pricing.taxes ?? calculatedSubtotal * 0.18) || 0) * 100) / 100; // 18% GST
    this.pricing.serviceFee = Math.round(((this.pricing.serviceFee ?? calculatedSubtotal * 0.05) || 0) * 100) / 100; // 5% service fee
    this.pricing.totalPrice = Math.round(
      (calculatedSubtotal + this.pricing.taxes + this.pricing.serviceFee - (this.pricing.discount || 0)) * 100
    ) / 100;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
