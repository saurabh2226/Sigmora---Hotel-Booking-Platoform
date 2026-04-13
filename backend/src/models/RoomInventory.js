const mongoose = require('mongoose');

const roomInventorySchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    heldCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    confirmedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

roomInventorySchema.index({ room: 1, date: 1 }, { unique: true });
roomInventorySchema.index({ hotel: 1, date: 1 });

module.exports = mongoose.model('RoomInventory', roomInventorySchema);
