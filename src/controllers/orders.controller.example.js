// Example: Order Controller with Activity Tracking
// This file shows how to integrate the ActivityTracker service into your controllers

const Order = require('../models/Order');
const ActivityTracker = require('../utils/activityTracker');
const realtimeActivityService = require('../utils/realtimeActivityService');
const { BadRequestError, NotFoundError } = require('../utils/customErrors');

// ============================================
// Example 1: Create Order with Tracking
// ============================================

const createOrder = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { items, restaurantId, deliveryAddress, paymentMethod } = req.body;

    // Validate request
    if (!items || !restaurantId) {
      throw new BadRequestError('Missing required fields');
    }

    // Create order
    const order = await Order.create({
      user: req.user.id,
      restaurant: restaurantId,
      items,
      deliveryAddress,
      paymentMethod,
      totalAmount: calculateTotal(items),
      status: 'PENDING',
    });

    // Populate for response
    await order.populate('restaurant', 'name');
    await order.populate('items.dish', 'name price');

    const duration = Date.now() - startTime;

    // Track activity
    await ActivityTracker.trackActivity({
      type: 'ORDER_PLACED',
      userId: req.user.id,
      orderId: order._id,
      restaurantId: order.restaurant._id,
      description: `Order placed for $${order.totalAmount} at ${order.restaurant.name}`,
      details: {
        orderId: order._id.toString(),
        total: order.totalAmount,
        items: order.items.length,
        paymentMethod,
        restaurant: order.restaurant.name,
      },
      severity: 'SUCCESS',
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      duration,
    });

    // Broadcast to real-time connected clients (admins)
    await realtimeActivityService.broadcastActivity({
      type: 'ORDER_PLACED',
      userId: req.user.id,
      orderId: order._id,
      restaurantId: order.restaurant._id,
      description: `New order placed for $${order.totalAmount}`,
      details: {
        orderId: order._id,
        total: order.totalAmount,
        items: order.items.length,
      },
      severity: 'SUCCESS',
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      duration,
    });

    // Alert admins for high-value orders
    if (order.totalAmount > 500) {
      realtimeActivityService.broadcastToAdmins('alert:high-value-order', {
        orderId: order._id,
        amount: order.totalAmount,
        restaurant: order.restaurant.name,
        user: req.user.name,
      });
    }

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Example 2: Update Order Status with Tracking
// ============================================

const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status, estimatedDelivery } = req.body;

    const startTime = Date.now();

    // Find existing order
    const order = await Order.findById(orderId).populate('restaurant', 'name').populate('user', 'name email');

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const oldStatus = order.status;

    // Update order
    order.status = status;
    if (estimatedDelivery) {
      order.estimatedDelivery = estimatedDelivery;
    }
    await order.save();

    const duration = Date.now() - startTime;

    // Track activity
    const severity = status === 'FAILED' ? 'ERROR' : status === 'DELIVERED' ? 'SUCCESS' : 'INFO';

    await ActivityTracker.trackActivity({
      type: 'ORDER_UPDATED',
      adminId: req.user.id,
      userId: order.user._id,
      orderId: order._id,
      restaurantId: order.restaurant._id,
      description: `Order status updated from ${oldStatus} to ${status}`,
      details: {
        orderId: order._id.toString(),
        oldStatus,
        newStatus: status,
        estimatedDelivery,
        user: order.user.email,
        restaurant: order.restaurant.name,
      },
      severity,
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      duration,
    });

    // Notify user of status update via real-time
    realtimeActivityService.broadcastToUser(
      order.user._id.toString(),
      'order:status-updated',
      {
        orderId: order._id,
        status,
        estimatedDelivery,
        message: `Your order status has been updated to ${status}`,
      }
    );

    // Broadcast to public feed
    await realtimeActivityService.broadcastActivity({
      type: 'ORDER_UPDATED',
      adminId: req.user.id,
      orderId: order._id,
      description: `Order ${order._id} status updated to ${status}`,
      details: { oldStatus, newStatus: status },
      severity,
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      duration,
    });

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Example 3: Cancel Order with Error Tracking
// ============================================

const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const startTime = Date.now();

    const order = await Order.findById(orderId).populate('restaurant', 'name').populate('user', 'email');

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status === 'DELIVERED') {
      throw new BadRequestError('Cannot cancel delivered order');
    }

    // Cancel order
    order.status = 'CANCELLED';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    await order.save();

    const duration = Date.now() - startTime;

    // Track successful cancellation
    await ActivityTracker.trackActivity({
      type: 'ORDER_UPDATED',
      userId: req.user.id,
      orderId: order._id,
      restaurantId: order.restaurant._id,
      description: `Order cancelled. Reason: ${reason}`,
      details: {
        orderId: order._id.toString(),
        cancellationReason: reason,
        previousStatus: order.status,
      },
      severity: 'INFO',
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      duration,
    });

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    // Track failed cancellation attempt
    await ActivityTracker.trackActivity({
      type: 'ORDER_UPDATED',
      userId: req.user?.id,
      orderId: req.params?.orderId,
      description: `Order cancellation failed: ${error.message}`,
      details: {
        error: error.message,
      },
      severity: 'ERROR',
      status: 'FAILED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(err => {
      console.error('Failed to track failed activity:', err);
    });

    next(error);
  }
};

// ============================================
// Example 4: Get Order with Tracking
// ============================================

const getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('restaurant', 'name')
      .populate('items.dish', 'name price');

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Track order view (non-critical, fire and forget)
    ActivityTracker.trackActivity({
      type: 'ORDER_VIEWED',
      userId: req.user.id,
      orderId: order._id,
      description: `Order viewed`,
      severity: 'INFO',
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(err => {
      console.error('Failed to track view activity:', err);
    });

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Example 5: Batch Update Orders with Tracking
// ============================================

const updateMultipleOrders = async (req, res, next) => {
  try {
    const { orderIds, status } = req.body;
    const startTime = Date.now();

    let successCount = 0;
    let failureCount = 0;

    for (const orderId of orderIds) {
      try {
        await Order.findByIdAndUpdate(orderId, { status });
        successCount++;
      } catch (error) {
        failureCount++;
      }
    }

    const duration = Date.now() - startTime;

    // Track batch operation
    await ActivityTracker.trackActivity({
      type: 'BATCH_ORDER_UPDATE',
      adminId: req.user.id,
      description: `Batch updated ${successCount} orders to ${status}`,
      details: {
        totalOrders: orderIds.length,
        successCount,
        failureCount,
        newStatus: status,
      },
      severity: failureCount > 0 ? 'WARNING' : 'SUCCESS',
      status: 'COMPLETED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      duration,
    });

    res.json({
      success: true,
      message: `Updated ${successCount} orders, ${failureCount} failed`,
      data: {
        success: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Example 6: Get Order Statistics
// ============================================

const getOrderStatistics = async (req, res, next) => {
  try {
    // Get activity statistics for orders
    const stats = await ActivityTracker.getActivityStats({
      type: 'ORDER_PLACED',
      createdAt: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
      },
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Helper Functions
// ============================================

const calculateTotal = (items) => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

// ============================================
// Export Routes
// ============================================

module.exports = {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrder,
  updateMultipleOrders,
  getOrderStatistics,
};

/*
============================================
INTEGRATION CHECKLIST:
============================================

1. ✓ Import ActivityTracker
2. ✓ Track successful operations
3. ✓ Track failed operations
4. ✓ Include context (userId, resourceId, etc.)
5. ✓ Set appropriate severity levels
6. ✓ Include details for debugging
7. ✓ Measure operation duration
8. ✓ Capture IP and user agent
9. ✓ Use real-time broadcasting for important events
10. ✓ Don't block requests on activity tracking

============================================
USAGE IN ROUTES:
============================================

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/auth.middleware');
const {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrder,
  updateMultipleOrders,
  getOrderStatistics,
} = require('../controllers/orders.controller');

const router = express.Router();

// Public/User routes
router.post('/', authenticate, createOrder);
router.get('/:orderId', authenticate, getOrder);
router.put('/:orderId/cancel', authenticate, cancelOrder);

// Admin routes
router.put('/:orderId/status', authenticate, authorize(['admin']), updateOrderStatus);
router.put('/batch/update', authenticate, authorize(['admin']), updateMultipleOrders);
router.get('/stats/daily', authenticate, authorize(['admin']), getOrderStatistics);

module.exports = router;

============================================
INTEGRATION NOTES:
============================================

1. Error Tracking:
   - Catch errors and track them with severity ERROR
   - Don't block response on tracking failure
   - Use .catch() for non-blocking tracking

2. Performance:
   - Track operation duration for monitoring
   - Use fire-and-forget for non-critical activities
   - Don't await tracking in critical paths

3. Real-Time Updates:
   - Broadcast important events (new orders, status updates)
   - Send alerts for special cases (high-value orders)
   - Notify affected users (order status to customer)

4. Details Object:
   - Include what changed
   - Include related IDs
   - Include metadata for debugging
   - Avoid sensitive data

5. Severity Levels:
   - INFO: Normal operations
   - SUCCESS: Successful key operations
   - WARNING: Important but handled situations
   - ERROR: Failures requiring attention

============================================
TESTING THE INTEGRATION:
============================================

// Start server
npm start

// Create order (track ORDER_PLACED)
POST /api/orders
{
  "items": [...],
  "restaurantId": "...",
  "deliveryAddress": "...",
  "paymentMethod": "card"
}

// Check activity was tracked
GET /api/activities?type=ORDER_PLACED

// Check real-time stats
GET /api/activities/user/dashboard

// Get all activities
GET /api/activities?page=1&limit=20

============================================
*/
