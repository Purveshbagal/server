const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const {
  getDashboardStats,
  getDashboardOrders,
  getOrderDetails,
  updateOrderStatus,
  getSalesAnalytics
} = require('../controllers/admin-dashboard.controller');

// Get dashboard statistics and analytics
router.get('/stats', auth, admin, getDashboardStats);

// Get all orders with filters
router.get('/orders', auth, admin, getDashboardOrders);

// Get single order details
router.get('/orders/:orderId', auth, admin, getOrderDetails);

// Update order status
router.patch('/orders/:orderId/status', auth, admin, updateOrderStatus);

// Get sales analytics
router.get('/analytics', auth, admin, getSalesAnalytics);

module.exports = router;
