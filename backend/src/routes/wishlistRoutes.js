const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getWishlist, toggleWishlist, removeFromWishlist } = require('../controllers/wishlistController');

router.get('/', auth, getWishlist);
router.post('/:hotelId', auth, toggleWishlist);
router.delete('/:hotelId', auth, removeFromWishlist);

module.exports = router;
