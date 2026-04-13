const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getUserById, updatePreferences, deleteAccount } = require('../controllers/userController');

router.get('/:id', getUserById);
router.put('/preferences', auth, updatePreferences);
router.delete('/account', auth, deleteAccount);

module.exports = router;
