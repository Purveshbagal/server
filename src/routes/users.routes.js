const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, addToFavorites, removeFromFavorites, getFavorites } = require('../controllers/users.controller');
const auth = require('../middlewares/auth.middleware');

// Routes
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);

// Favorites routes
router.get('/favorites', auth, getFavorites);
router.post('/favorites/:type/:id', auth, addToFavorites);
router.delete('/favorites/:type/:id', auth, removeFromFavorites);

module.exports = router;
