const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const { getNotifications, markRead } = require('../controllers/notifications.controller');

// Get notifications (admin gets admin notifications)
router.get('/', auth, getNotifications);

// Mark as read (id or 'all')
router.patch('/:id/read', auth, markRead);

module.exports = router;
