const express = require('express');
const router = express.Router();
const { broadcastTestActivity } = require('../controllers/dev.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/auth.middleware');

// Dev-only: allow authenticated admins to broadcast a test activity
router.post('/activity-test', authenticate, authorize(['admin']), broadcastTestActivity);

module.exports = router;
