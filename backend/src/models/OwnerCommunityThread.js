const mongoose = require('mongoose');

const ownerCommunityReplySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1200, 'Reply cannot exceed 1200 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ownerCommunityThreadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Thread title is required'],
      trim: true,
      maxlength: [140, 'Thread title cannot exceed 140 characters'],
    },
    category: {
      type: String,
      enum: ['general', 'operations', 'pricing', 'marketing', 'support', 'growth', 'admin-updates'],
      default: 'general',
      index: true,
    },
    body: {
      type: String,
      required: [true, 'Thread body is required'],
      trim: true,
      maxlength: [4000, 'Thread body cannot exceed 4000 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    replies: {
      type: [ownerCommunityReplySchema],
      default: [],
    },
  },
  { timestamps: true }
);

ownerCommunityThreadSchema.index({ isPinned: -1, lastActivityAt: -1 });

module.exports = mongoose.model('OwnerCommunityThread', ownerCommunityThreadSchema);
