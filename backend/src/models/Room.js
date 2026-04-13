const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Room title is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe', 'penthouse', 'dormitory'],
      required: [true, 'Room type is required'],
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price cannot be negative'],
    },
    maxGuests: {
      type: Number,
      required: [true, 'Max guests is required'],
    },
    bedType: {
      type: String,
      enum: ['single', 'double', 'queen', 'king', 'twin'],
    },
    roomSize: {
      type: Number, // in sq ft
    },
    images: [
      {
        url: String,
        publicId: String,
      },
    ],
    amenities: [String],
    totalRooms: {
      type: Number,
      required: true,
      default: 1,
    },
    unavailableDates: [{ type: Date }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for hotel lookups
roomSchema.index({ hotel: 1, isActive: 1 });
roomSchema.index({ hotel: 1, type: 1 });

module.exports = mongoose.model('Room', roomSchema);
