const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, adminLogin, getMe } = require('../controllers/auth.controller');
const auth = require('../middlewares/auth.middleware');

// Routes
router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', auth, getMe);

module.exports = router;
