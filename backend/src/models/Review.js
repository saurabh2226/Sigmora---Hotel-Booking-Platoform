const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    categories: {
      cleanliness: { type: Number, min: 1, max: 5 },
      comfort: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
      facilities: { type: Number, min: 1, max: 5 },
      staff: { type: Number, min: 1, max: 5 },
      valueForMoney: { type: Number, min: 1, max: 5 },
    },
    images: [
      {
        url: String,
        publicId: String,
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    response: {
      text: String,
      respondedAt: Date,
    },
  },
  { timestamps: true }
);

// Unique compound index: one review per user per booking
reviewSchema.index({ user: 1, hotel: 1, booking: 1 }, { unique: true });
reviewSchema.index({ hotel: 1, createdAt: -1 });

// Post-save: recalculate hotel average rating
reviewSchema.post('save', async function () {
  const Review = this.constructor;
  const Hotel = mongoose.model('Hotel');

  const stats = await Review.aggregate([
    { $match: { hotel: this.hotel } },
    {
      $group: {
        _id: '$hotel',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Hotel.findByIdAndUpdate(this.hotel, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].count,
    });
  }
});

// Post-remove: recalculate hotel average rating
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const Review = mongoose.model('Review');
    const Hotel = mongoose.model('Hotel');

    const stats = await Review.aggregate([
      { $match: { hotel: doc.hotel } },
      {
        $group: {
          _id: '$hotel',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Hotel.findByIdAndUpdate(doc.hotel, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        totalReviews: stats[0].count,
      });
    } else {
      await Hotel.findByIdAndUpdate(doc.hotel, {
        rating: 0,
        totalReviews: 0,
      });
    }
  }
});

module.exports = mongoose.model('Review', reviewSchema);
