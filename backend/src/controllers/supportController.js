const Hotel = require('../models/Hotel');
const SupportConversation = require('../models/SupportConversation');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isAdminRole, isOwnerRole } = require('../middleware/roles');
const { createNotification } = require('../services/notificationService');
const { sendSupportQueryAlertEmail, sendSupportReplyEmail } = require('../services/emailService');
const { getAssistantResponse } = require('../services/assistantService');
const { emitToUser } = require('../socket/socketHandler');

const getSenderRole = (role) => {
  if (isAdminRole(role)) return 'admin';
  if (isOwnerRole(role)) return 'owner';
  return 'user';
};

const getConversationQuery = (user) => {
  if (isAdminRole(user.role)) return {};
  if (isOwnerRole(user.role)) return { owner: user._id };
  return { user: user._id };
};

const populateConversation = (query) => query
  .populate('hotel', 'title slug address.city images')
  .populate('user', 'name email avatar role')
  .populate('owner', 'name email avatar role')
  .populate('messages.sender', 'name email role avatar');

const ensureConversationAccess = async (conversationId, user) => {
  const conversation = await populateConversation(
    SupportConversation.findById(conversationId)
  );

  if (!conversation) {
    throw new ApiError(404, 'Support conversation not found');
  }

  const hasAccess = isAdminRole(user.role)
    || conversation.user._id.toString() === user._id.toString()
    || conversation.owner._id.toString() === user._id.toString();

  if (!hasAccess) {
    throw new ApiError(403, 'You are not allowed to access this conversation');
  }

  return conversation;
};

const notifyConversationParticipants = async (conversation, sender, latestMessage) => {
  const recipients = new Map();
  const senderId = String(sender._id);
  const hotelTitle = conversation.hotel?.title || 'this hotel';

  const addRecipient = ({ userId, title, message }) => {
    if (!userId) {
      return;
    }

    const normalizedId = String(userId);
    if (!normalizedId || normalizedId === senderId) {
      return;
    }

    recipients.set(normalizedId, {
      userId: normalizedId,
      title,
      message,
    });
  };

  addRecipient({
    userId: conversation.user?._id,
    title: `New reply from ${sender.name}`,
    message: latestMessage.text,
  });

  addRecipient({
    userId: conversation.owner?._id,
    title: `New support message for ${hotelTitle}`,
    message: latestMessage.text,
  });

  if (getSenderRole(sender.role) === 'user') {
    const adminAudience = await User.find({
      _id: { $ne: sender._id },
      isActive: true,
      role: { $in: ['admin', 'owner', 'superadmin'] },
    })
      .select('_id')
      .lean();

    adminAudience.forEach((adminUser) => {
      addRecipient({
        userId: adminUser._id,
        title: `New guest query for ${hotelTitle}`,
        message: latestMessage.text,
      });
    });
  }

  const recipientList = Array.from(recipients.values());

  await Promise.all(recipientList.map(({ userId, title, message }) => (
    createNotification({
      userId,
      type: 'system',
      title,
      message,
      link: `/support?conversation=${conversation._id}`,
      metadata: { conversationId: conversation._id },
    })
  )));

  recipientList.forEach(({ userId }) => {
    emitToUser(String(userId), 'support:updated', {
      conversationId: conversation._id,
      latestMessage,
    });
  });
};

const alertOwnerAboutGuestMessage = async (conversation, sender, latestMessage) => {
  if (getSenderRole(sender.role) !== 'user' || !conversation?.owner?.email) {
    return;
  }

  await sendSupportQueryAlertEmail({
    owner: conversation.owner,
    guest: conversation.user,
    hotel: conversation.hotel,
    latestMessage,
    conversationId: conversation._id,
    subject: conversation.subject,
  });
};

const alertGuestAboutOwnerReply = async (conversation, sender, latestMessage) => {
  const senderRole = getSenderRole(sender.role);
  if (senderRole === 'user' || !conversation?.user?.email) {
    return;
  }

  await sendSupportReplyEmail({
    recipient: conversation.user,
    sender,
    hotel: conversation.hotel,
    latestMessage,
    conversationId: conversation._id,
    subject: conversation.subject,
  });
};

// @desc    List support conversations
// @route   GET /api/v1/support/conversations
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await populateConversation(
    SupportConversation.find(getConversationQuery(req.user)).sort({ lastMessageAt: -1 })
  ).lean();

  res.status(200).json(new ApiResponse(200, { conversations }));
});

// @desc    Get support conversation
// @route   GET /api/v1/support/conversations/:id
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await ensureConversationAccess(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, { conversation }));
});

// @desc    Create or reopen a support conversation
// @route   POST /api/v1/support/conversations
const createConversation = asyncHandler(async (req, res) => {
  if (isOwnerRole(req.user.role)) {
    throw new ApiError(403, 'Only guests can start a fresh support chat');
  }

  const { hotelId, subject, message } = req.body;
  const trimmedMessage = message?.trim();

  if (!hotelId) throw new ApiError(400, 'Hotel is required');
  if (!trimmedMessage) throw new ApiError(400, 'Message is required');

  const hotel = await Hotel.findById(hotelId).populate('createdBy', 'name email role');
  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  if (!hotel.createdBy) {
    throw new ApiError(400, 'This hotel is not assigned to an admin manager yet');
  }

  let conversation = await SupportConversation.findOne({
    hotel: hotel._id,
    user: req.user._id,
    owner: hotel.createdBy._id,
    status: 'open',
  });

  const messagePayload = {
    sender: req.user._id,
    senderRole: getSenderRole(req.user.role),
    text: trimmedMessage,
  };

  if (!conversation) {
    conversation = await SupportConversation.create({
      hotel: hotel._id,
      user: req.user._id,
      owner: hotel.createdBy._id,
      subject: subject?.trim() || `Questions about ${hotel.title}`,
      messages: [messagePayload],
      lastMessageAt: new Date(),
    });
  } else {
    conversation.messages.push(messagePayload);
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  const populatedConversation = await ensureConversationAccess(conversation._id, req.user);
  const latestMessage = populatedConversation.messages[populatedConversation.messages.length - 1];
  await notifyConversationParticipants(populatedConversation, req.user, latestMessage);
  await alertOwnerAboutGuestMessage(populatedConversation, req.user, latestMessage);
  await alertGuestAboutOwnerReply(populatedConversation, req.user, latestMessage);

  res.status(201).json(new ApiResponse(201, { conversation: populatedConversation }, 'Support conversation started'));
});

// @desc    Send message in a support conversation
// @route   POST /api/v1/support/conversations/:id/messages
const sendMessage = asyncHandler(async (req, res) => {
  const text = req.body.text?.trim();
  if (!text) {
    throw new ApiError(400, 'Message is required');
  }

  const conversation = await ensureConversationAccess(req.params.id, req.user);
  conversation.messages.push({
    sender: req.user._id,
    senderRole: getSenderRole(req.user.role),
    text,
  });
  conversation.status = 'open';
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const updatedConversation = await ensureConversationAccess(req.params.id, req.user);
  const latestMessage = updatedConversation.messages[updatedConversation.messages.length - 1];
  await notifyConversationParticipants(updatedConversation, req.user, latestMessage);
  await alertOwnerAboutGuestMessage(updatedConversation, req.user, latestMessage);
  await alertGuestAboutOwnerReply(updatedConversation, req.user, latestMessage);

  res.status(200).json(new ApiResponse(200, { conversation: updatedConversation }, 'Message sent'));
});

// @desc    Update conversation status
// @route   PUT /api/v1/support/conversations/:id/status
const updateConversationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) {
    throw new ApiError(400, 'Invalid conversation status');
  }

  const conversation = await ensureConversationAccess(req.params.id, req.user);
  conversation.status = status;
  await conversation.save();

  res.status(200).json(new ApiResponse(200, { conversation }, `Conversation ${status}`));
});

// @desc    Get Sigmora assistant reply
// @route   POST /api/v1/support/assistant
const askAssistant = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) {
    throw new ApiError(400, 'Message is required');
  }

  const result = await getAssistantResponse({
    message,
    userId: req.user?._id,
  });

  res.status(200).json(new ApiResponse(200, result, 'Assistant reply generated'));
});

module.exports = {
  getConversations,
  getConversation,
  createConversation,
  sendMessage,
  updateConversationStatus,
  askAssistant,
};
