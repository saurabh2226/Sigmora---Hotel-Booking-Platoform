const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendNewsletterSubscriptionEmail } = require('../services/emailService');

const subscribeNewsletter = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  const source = String(req.body.source || 'homepage').trim();

  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        name,
        source,
        isActive: true,
        subscribedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  sendNewsletterSubscriptionEmail({
    email: subscriber.email,
    name: subscriber.name || 'traveler',
  }).catch(console.error);

  res.status(200).json(new ApiResponse(200, {
    subscriber: {
      email: subscriber.email,
      isActive: subscriber.isActive,
    },
  }, 'Subscription successful'));
});

module.exports = {
  subscribeNewsletter,
};
