const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { supportWriteLimiter } = require('../middleware/rateLimiter');
const {
  getConversations,
  getConversation,
  createConversation,
  sendMessage,
  updateConversationStatus,
  askAssistant,
} = require('../controllers/supportController');

router.use(auth);

router.get('/conversations', getConversations);
router.post('/conversations', supportWriteLimiter, createConversation);
router.get('/conversations/:id', getConversation);
router.post('/conversations/:id/messages', supportWriteLimiter, sendMessage);
router.put('/conversations/:id/status', supportWriteLimiter, updateConversationStatus);
router.post('/assistant', supportWriteLimiter, askAssistant);

module.exports = router;
