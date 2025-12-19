const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const {
  upsertCourier,
  updateLocation,
  findNearby,
  getCourier,
  getMe,
  acceptJob,
  rejectJob,
} = require('../controllers/couriers.controller');

// Create or update courier profile (authenticated users)
router.post('/', auth, upsertCourier);

// Get current courier profile
router.get('/me', auth, getMe);

// Update courier location/status
router.patch('/:id/location', auth, updateLocation);

// Find nearby available couriers
router.get('/near', auth, findNearby);

// Get courier
router.get('/:id', auth, getCourier);

// Job accept/reject
router.post('/:id/jobs/:orderId/accept', auth, acceptJob);
router.post('/:id/jobs/:orderId/reject', auth, rejectJob);

module.exports = router;
