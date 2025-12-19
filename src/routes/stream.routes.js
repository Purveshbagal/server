const express = require('express');
const router = express.Router();
const { eventsHandler } = require('../utils/stream');

// SSE endpoint
router.get('/events', eventsHandler);

module.exports = router;
