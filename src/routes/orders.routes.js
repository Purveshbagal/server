const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateTracking,
  assignNearestCourier,
} = require('../controllers/orders.controller');
const { getInvoiceForOrder } = require('../controllers/invoices.controller');
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');

// Routes
router.post('/', auth, createOrder);
router.get('/', auth, getOrders);
router.get('/:id', auth, getOrder);
router.put('/:id/status', auth, admin, updateOrderStatus);
// Update tracking/courier info or current location (admin or authorized courier)
router.put('/:id/track', auth, updateTracking);
// Assign nearest available courier (admin)
router.post('/:id/assign', auth, admin, assignNearestCourier);
// Get invoice for an order
router.get('/:id/invoice', auth, getInvoiceForOrder);

module.exports = router;
