const express = require('express');
const router = express.Router();
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} = require('../controllers/restaurants.controller');
const { getDishes, createDish } = require('../controllers/dishes.controller');
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const upload = require('../middlewares/upload.middleware');

// Routes
router.get('/', getRestaurants);
router.get('/:id', getRestaurant);
// Support fetching/creating dishes via restaurants path for frontend compatibility
router.get('/:id/dishes', getDishes);
router.post('/:id/dishes', auth, admin, upload.single('image'), createDish);
router.post('/', auth, admin, upload.single('image'), createRestaurant);
router.put('/:id', auth, admin, upload.single('image'), updateRestaurant);
router.delete('/:id', auth, admin, deleteRestaurant);

module.exports = router;
