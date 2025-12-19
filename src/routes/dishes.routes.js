const express = require('express');
const router = express.Router();
const {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
} = require('../controllers/dishes.controller');
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const upload = require('../middlewares/upload.middleware');

// Routes
router.get('/', getDishes);
router.get('/restaurants/:restaurantId/dishes', getDishes);
router.post('/restaurants/:restaurantId/dishes', auth, admin, upload.single('image'), createDish);
router.put('/:id', auth, admin, upload.single('image'), updateDish);
router.delete('/:id', auth, admin, deleteDish);

module.exports = router;
