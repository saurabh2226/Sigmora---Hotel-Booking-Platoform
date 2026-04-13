const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['user', 'owner', 'admin'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const supportConversationSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [120, 'Subject cannot exceed 120 characters'],
      default: 'Booking and stay support',
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    messages: {
      type: [supportMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

supportConversationSchema.index({ user: 1, updatedAt: -1 });
supportConversationSchema.index({ owner: 1, updatedAt: -1 });
supportConversationSchema.index({ hotel: 1, status: 1 });

module.exports = mongoose.model('SupportConversation', supportConversationSchema);
