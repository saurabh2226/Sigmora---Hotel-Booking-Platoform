const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getNotifications, markAsRead, markAllAsRead, getUnreadCount,
} = require('../controllers/notificationController');

router.use(auth);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
