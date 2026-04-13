const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');
const { subscribeNewsletter } = require('../controllers/subscriptionController');

const newsletterValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters'),
  body('source')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 40 }).withMessage('Invalid source'),
];

router.post('/newsletter', authLimiter, newsletterValidation, validate, subscribeNewsletter);

module.exports = router;
