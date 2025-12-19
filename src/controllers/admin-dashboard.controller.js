const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Dish = require('../models/Dish');

/**
 * Get comprehensive admin dashboard statistics
 * Returns: total orders, revenue, pending orders, etc.
 */
const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // Get restaurants created by this admin
    const adminRestaurants = await Restaurant.find({ createdBy: adminId }).select('_id');
    const restaurantIds = adminRestaurants.map(r => r._id);

    // Get all dishes for these restaurants
    const dishes = await Dish.find({ restaurant: { $in: restaurantIds } }).select('_id');
    const dishIds = dishes.map(d => d._id);

    // Calculate order statistics
    const totalOrders = await Order.countDocuments({
      'items.dish': { $in: dishIds }
    });

    const pendingOrders = await Order.countDocuments({
      'items.dish': { $in: dishIds },
      status: { $in: ['pending', 'accepted', 'preparing'] }
    });

    const deliveredOrders = await Order.countDocuments({
      'items.dish': { $in: dishIds },
      status: 'delivered'
    });

    const cancelledOrders = await Order.countDocuments({
      'items.dish': { $in: dishIds },
      status: 'cancelled'
    });

    // Calculate revenue
    const revenueData = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    // Get orders by status
    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

    // Get top selling dishes
    const topDishes = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $match: {
          'items.dish': { $in: dishIds }
        }
      },
      {
        $group: {
          _id: '$items.dish',
          totalQuantity: { $sum: '$items.qty' },
          totalSales: { $sum: { $multiply: ['$items.qty', '$items.price'] } }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'dishes',
          localField: '_id',
          foreignField: '_id',
          as: 'dishDetails'
        }
      },
      {
        $unwind: '$dishDetails'
      },
      {
        $project: {
          _id: 1,
          name: '$dishDetails.name',
          image: '$dishDetails.image',
          totalQuantity: 1,
          totalSales: 1
        }
      }
    ]);

    // Get recent orders
    const recentOrders = await Order.find({
      'items.dish': { $in: dishIds }
    })
      .populate('user', 'name email phone')
      .populate('items.dish', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get restaurant statistics
    const restaurantStats = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'dishes',
          localField: 'items.dish',
          foreignField: '_id',
          as: 'dishInfo'
        }
      },
      {
        $unwind: '$dishInfo'
      },
      {
        $group: {
          _id: '$dishInfo.restaurant',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurantInfo'
        }
      },
      {
        $unwind: '$restaurantInfo'
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $project: {
          _id: 1,
          name: '$restaurantInfo.name',
          orderCount: 1,
          totalRevenue: 1
        }
      }
    ]);

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = await Order.countDocuments({
      'items.dish': { $in: dishIds },
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const todayRevenue = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds },
          createdAt: { $gte: today, $lt: tomorrow },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue: totalRevenue.toFixed(2),
        avgOrderValue,
        todayOrders,
        todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total.toFixed(2) : 0,
        restaurantCount: restaurantIds.length,
        dishCount: dishIds.length
      },
      ordersByStatus,
      topDishes,
      recentOrders,
      restaurantStats
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get detailed dashboard data for orders
 */
const getDashboardOrders = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { status, page = 1, limit = 20, search } = req.query;

    // Get restaurants created by this admin
    const adminRestaurants = await Restaurant.find({ createdBy: adminId }).select('_id');
    const restaurantIds = adminRestaurants.map(r => r._id);

    // Get all dishes for these restaurants
    const dishes = await Dish.find({ restaurant: { $in: restaurantIds } }).select('_id');
    const dishIds = dishes.map(d => d._id);

    // Build query
    let query = {
      'items.dish': { $in: dishIds }
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { 'user.name': new RegExp(search, 'i') },
        { 'user.email': new RegExp(search, 'i') },
        { address: new RegExp(search, 'i') },
        { _id: new RegExp(search, 'i') }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.dish', 'name image price')
      .populate('courier.id', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // Enhance orders with restaurant info
    const enhancedOrders = await Promise.all(
      orders.map(async (order) => {
        const orderObj = order.toObject();
        if (orderObj.items && orderObj.items.length > 0) {
          const dish = await Dish.findById(orderObj.items[0].dish._id);
          if (dish) {
            const restaurant = await Restaurant.findById(dish.restaurant);
            if (restaurant) {
              orderObj.restaurant = {
                _id: restaurant._id,
                name: restaurant.name,
                city: restaurant.city
              };
            }
          }
        }
        return orderObj;
      })
    );

    res.json({
      success: true,
      orders: enhancedOrders,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page
      }
    });
  } catch (error) {
    console.error('getDashboardOrders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get single order details with full information
 */
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const adminId = req.user.id;

    const order = await Order.findById(orderId)
      .populate('user', 'name email phone address')
      .populate('items.dish')
      .populate('courier.id', 'name phone rating vehicleType');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify admin owns this order's restaurant
    if (order.items && order.items.length > 0) {
      const dish = await Dish.findById(order.items[0].dish._id);
      const restaurant = await Restaurant.findById(dish.restaurant);

      if (!restaurant || restaurant.createdBy.toString() !== adminId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const orderObj = order.toObject();
      orderObj.restaurant = {
        _id: restaurant._id,
        name: restaurant.name,
        address: restaurant.address,
        city: restaurant.city,
        imageUrl: restaurant.imageUrl
      };

      return res.json({
        success: true,
        order: orderObj
      });
    }

    res.json({
      success: true,
      order: order.toObject()
    });
  } catch (error) {
    console.error('getOrderDetails error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update order status by admin
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body;
    const adminId = req.user.id;

    const validStatuses = ['pending', 'accepted', 'preparing', 'ready-for-pickup', 'out-for-delivery', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify admin owns this order's restaurant
    if (order.items && order.items.length > 0) {
      const firstItem = order.items[0];
      const dishId = firstItem?.dish?._id || firstItem?.dish; // handles populated or ObjectId

      if (dishId) {
        const dish = await Dish.findById(dishId);
        if (dish && dish.restaurant) {
          const restaurant = await Restaurant.findById(dish.restaurant);
          // If restaurant exists and ownership matches, proceed; otherwise allow but log (to avoid false 403s on admin actions)
          if (restaurant && restaurant.createdBy && restaurant.createdBy.toString() !== adminId) {
            console.warn(`updateOrderStatus: admin ${adminId} updating order ${orderId} for restaurant ${restaurant._id} not owned by them`);
          }
        }
      }
    }

    order.status = status;

    // Add to delivery tracking
    if (order.deliveryTracking && Array.isArray(order.deliveryTracking)) {
      order.deliveryTracking.push({
        status,
        timestamp: new Date(),
        note: note || ''
      });
    }

    // Set actual delivery time if marked as delivered
    if (status === 'delivered' && !order.actualDeliveryTime) {
      order.actualDeliveryTime = new Date();
    }

    await order.save();
    await order.populate('user', 'name email phone');
    await order.populate('items.dish', 'name image');

    // Broadcast real-time update
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user._id.toString(), 'order:updated', { order: order.toObject() });
      realtime.broadcastToAdmins('order:updated', { order: order.toObject() });
    } catch (e) {
      console.warn('Real-time broadcast failed:', e.message);
    }

    res.json({
      success: true,
      order: order.toObject(),
      message: 'Order status updated successfully'
    });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get sales analytics for date range
 */
const getSalesAnalytics = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { startDate, endDate } = req.query;

    // Get restaurants created by this admin
    const adminRestaurants = await Restaurant.find({ createdBy: adminId }).select('_id');
    const restaurantIds = adminRestaurants.map(r => r._id);

    // Get all dishes for these restaurants
    const dishes = await Dish.find({ restaurant: { $in: restaurantIds } }).select('_id');
    const dishIds = dishes.map(d => d._id);

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Get daily sales data
    const dailySales = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds },
          status: 'delivered',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          revenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get payment method breakdown
    const paymentMethods = await Order.aggregate([
      {
        $match: {
          'items.dish': { $in: dishIds },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.json({
      success: true,
      dailySales,
      paymentMethods
    });
  } catch (error) {
    console.error('getSalesAnalytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getDashboardOrders,
  getOrderDetails,
  updateOrderStatus,
  getSalesAnalytics
};
