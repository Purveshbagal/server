const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const upload = require('../middlewares/upload.middleware');
const { body } = require('express-validator');
const {
  getAdminRestaurants,
  createRestaurant,
} = require('../controllers/restaurants.controller');
const {
  getDishes,
  createDish,
} = require('../controllers/dishes.controller');
const {
  promoteToAdmin,
} = require('../controllers/users.controller');
const {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus
} = require('../controllers/banners.controller');

// Admin routes for restaurants
router.get('/restaurants', auth, admin, getAdminRestaurants); // List current admin's restaurants
router.post('/restaurants', auth, admin, upload.single('image'), createRestaurant);

// Admin routes for dishes
router.get('/restaurants/:id/dishes', auth, admin, getDishes); // List dishes for a restaurant (admin view)
router.post('/restaurants/:id/dishes', auth, admin, upload.single('image'), createDish);

// Admin routes for banners
router.get('/banners', auth, admin, getBanners);
router.post('/banners', auth, admin, upload.single('image'), [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('imageUrl').optional().isURL().withMessage('Invalid image URL')
], createBanner);
router.put('/banners/:id', auth, admin, upload.single('image'), updateBanner);
router.delete('/banners/:id', auth, admin, deleteBanner);
router.patch('/banners/:id/toggle', auth, admin, toggleBannerStatus);

// Admin promote user
router.post('/promote', auth, admin, promoteToAdmin);

module.exports = router;
