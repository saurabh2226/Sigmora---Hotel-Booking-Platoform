const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const validate = require('../middleware/validate');
const { createReviewValidation } = require('../utils/validators');
const {
  createReview, getHotelReviews, updateReview, deleteReview,
  toggleHelpful, respondToReview,
} = require('../controllers/reviewController');

router.post('/', auth, createReviewValidation, validate, createReview);
router.get('/hotel/:hotelId', getHotelReviews);
router.put('/:id', auth, updateReview);
router.delete('/:id', auth, deleteReview);
router.post('/:id/helpful', auth, toggleHelpful);
router.post('/:id/respond', auth, admin, respondToReview);

module.exports = router;
