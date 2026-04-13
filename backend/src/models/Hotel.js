const mongoose = require('mongoose');
const slugify = require('slugify');

const hotelSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Hotel title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: ['hotel', 'resort', 'villa', 'apartment', 'hostel', 'guesthouse'],
      required: [true, 'Hotel type is required'],
    },
    address: {
      street: String,
      city: { type: String, required: [true, 'City is required'], index: true },
      state: { type: String, required: [true, 'State is required'] },
      country: { type: String, required: true, default: 'India' },
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    images: [
      {
        url: String,
        publicId: String,
        caption: String,
      },
    ],
    amenities: [
      {
        type: String,
        enum: [
          'wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant',
          'bar', 'room-service', 'laundry', 'ac', 'tv', 'breakfast',
          'pet-friendly', 'ev-charging', 'business-center', 'concierge',
        ],
      },
    ],
    policies: {
      checkInTime: { type: String, default: '14:00' },
      checkOutTime: { type: String, default: '11:00' },
      cancellation: {
        type: String,
        enum: ['free', 'moderate', 'strict'],
        default: 'moderate',
      },
      petsAllowed: { type: Boolean, default: false },
      smokingAllowed: { type: Boolean, default: false },
    },
    contact: {
      phone: String,
      email: String,
      website: String,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price cannot be negative'],
    },
    maxGuests: {
      type: Number,
      required: true,
      default: 2,
    },
    totalRooms: {
      type: Number,
      required: [true, 'Total rooms is required'],
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Text index for search
hotelSchema.index({ title: 'text', description: 'text', 'address.city': 'text' });

// Compound index for common queries
hotelSchema.index({ isActive: 1, isFeatured: 1 });
hotelSchema.index({ 'address.city': 1, pricePerNight: 1 });

// Pre-save: generate slug
hotelSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true }) + '-' + this._id.toString().slice(-6);
  }
  next();
});

module.exports = mongoose.model('Hotel', hotelSchema);
