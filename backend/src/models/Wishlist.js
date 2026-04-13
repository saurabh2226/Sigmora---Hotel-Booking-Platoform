const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique compound index: one wishlist item per user per hotel
wishlistSchema.index({ user: 1, hotel: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
