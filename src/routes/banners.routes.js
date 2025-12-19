const express = require('express');
const router = express.Router();
const { getActiveBanners } = require('../controllers/banners.controller');

// Public route to get active banners for homepage
router.get('/active', getActiveBanners);

module.exports = router;
