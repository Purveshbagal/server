const Joi = require('joi');
const Order = require('../models/Order');
const Dish = require('../models/Dish');

// Validation schemas
const orderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      dish: Joi.string().required(),
      qty: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
  address: Joi.string().required(),
  city: Joi.string().required(),
  paymentMethod: Joi.string().valid('cod', 'upi', 'card', 'gateway', 'other').default('cod'),
  paymentStatus: Joi.string().valid('pending', 'paid', 'failed').default('pending'),
});

const statusSchema = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'preparing', 'out-for-delivery', 'delivered', 'cancelled').required(),
});

// Create order
const createOrder = async (req, res) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { items, address, city, paymentMethod = 'cod', paymentStatus = 'pending' } = value;

    // Fetch dish details and calculate total
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const dish = await Dish.findById(item.dish);
      if (!dish) return res.status(404).json({ message: `Dish ${item.dish} not found` });
      if (!dish.available) return res.status(400).json({ message: `Dish ${dish.name} is not available` });

      const itemTotal = dish.price * item.qty;
      totalPrice += itemTotal;

      orderItems.push({
        dish: dish._id,
        name: dish.name,
        qty: item.qty,
        price: dish.price,
      });
    }

    const order = new Order({
      user: req.user.id,
      items: orderItems,
      totalPrice,
      address,
      city,
      paymentMethod,
      paymentStatus,
    });

    await order.save();
    await order.populate('items.dish');

    // Broadcast real-time order event via realtimeActivityService (socket.io)
    try {
      const realtime = require('../utils/realtimeActivityService');
      // Broadcast to the order owner
      realtime.broadcastToUser(req.user.id, 'order:created', { order: order.toObject() });
      // Broadcast to admins/operators
      realtime.broadcastToAdmins('order:created', { order: order.toObject() });
      // Persist a notification for admins
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          type: 'order_created',
          user: req.user.id,
          data: order.toObject(),
          forAdmins: true,
        });
      } catch (nerr) {
        console.warn('Failed to persist notification', nerr.message || nerr);
      }
    } catch (e) {
      // fallback to dev SSE stream if available
      try {
        const { sendEvent } = require('../utils/stream');
        sendEvent('order_created', { order: order.toObject() });
      } catch (er) {}
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get orders
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    let query = {};

    // If the requester is not an admin, only return their orders
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const orders = await Order.find(query)
      .populate('user', 'name email')
      .populate('items.dish', 'name image')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single order
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.dish', 'name image');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Check if user owns the order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { error } = statusSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { status } = req.body;

    // Fetch the order first to validate payment status
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    // DELIVERY RULE: Delivery must NOT start unless paymentStatus === "paid"
    // Prevent transitioning to delivery-related statuses if payment is not completed
    const deliveryStatuses = ['preparing', 'out-for-delivery', 'delivered'];
    if (deliveryStatuses.includes(status)) {
      if (existingOrder.paymentStatus !== 'paid' && existingOrder.paymentMethod !== 'cod') {
        return res.status(400).json({ 
          message: 'Payment must be completed before starting delivery process',
          paymentStatus: existingOrder.paymentStatus,
          paymentRequired: true
        });
      }

      // If payment failed, order should be cancelled
      if (existingOrder.paymentStatus === 'failed') {
        return res.status(400).json({ 
          message: 'Cannot process order with failed payment. Order is cancelled. Please retry payment.',
          paymentStatus: 'failed',
          orderStatus: 'cancelled'
        });
      }
    }

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, {
      new: true,
      runValidators: true,
    }).populate('user', 'name email').populate('items.dish', 'name image');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Broadcast order_updated event via realtime service
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user._id.toString(), 'order:updated', { order: order.toObject() });
      realtime.broadcastToAdmins('order:updated', { order: order.toObject() });
    } catch (e) {
      try {
        const { sendEvent } = require('../utils/stream');
        sendEvent('order_updated', { order: order.toObject() });
      } catch (er) {}
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get invoice for order
const { getInvoiceForOrder } = require('./invoices.controller');

// When order marked delivered, create invoice if not present
const postStatusHook = async (order) => {
  try {
    if (order.status === 'delivered') {
      const { createInvoiceForOrder } = require('./invoices.controller');
      await createInvoiceForOrder(order._id);
    }
  } catch (e) {
    console.error('postStatusHook error', e);
  }
};

// Update tracking info (location / courier) - accessible to admin or courier
const updateTracking = async (req, res) => {
  try {
    const { lat, lng, courierName, courierPhone } = req.body;

    // Fetch order to validate payment status before updating delivery tracking
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    // DELIVERY RULE: Delivery must NOT start unless paymentStatus === "paid"
    if (existingOrder.paymentStatus !== 'paid' && existingOrder.paymentMethod !== 'cod') {
      return res.status(400).json({ 
        message: 'Payment must be completed before tracking delivery',
        paymentStatus: existingOrder.paymentStatus,
        paymentRequired: true
      });
    }

    if (existingOrder.paymentStatus === 'failed') {
      return res.status(400).json({ 
        message: 'Cannot track delivery for order with failed payment',
        paymentStatus: 'failed'
      });
    }

    const update = {};
    if (lat !== undefined && lng !== undefined) {
      update.currentLocation = { lat: Number(lat), lng: Number(lng) };
    }
    if (courierName || courierPhone) {
      update.courier = {};
      if (courierName) update.courier.name = courierName;
      if (courierPhone) update.courier.phone = courierPhone;
      update.deliveryAssigned = true;
    }

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).populate('user', 'name email').populate('items.dish', 'name image');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Broadcast delivery location update via realtime service
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user._id.toString(), 'order:delivery:update', { order: order.toObject() });
      realtime.broadcastToAdmins('order:delivery:update', { order: order.toObject() });
    } catch (e) {
      try {
        const { sendEvent } = require('../utils/stream');
        sendEvent('delivery_updated', { order: order.toObject() });
      } catch (er) {}
    }

    // If status moved to delivered, ensure invoice exists
    try {
      if (order.status === 'delivered') {
        const { createInvoiceForOrder } = require('./invoices.controller');
        await createInvoiceForOrder(order._id);
      }
    } catch (e) {
      console.error('invoice create on tracking update failed', e);
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Assign nearest available courier to an order (admin trigger)
const assignNearestCourier = async (req, res) => {
  try {
    const OrderModel = Order;
    const order = await OrderModel.findById(req.params.id).populate('items.dish');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // DELIVERY RULE: Delivery must NOT start unless paymentStatus === "paid"
    if (order.paymentStatus !== 'paid' && order.paymentMethod !== 'cod') {
      return res.status(400).json({ 
        message: 'Payment must be completed before assigning courier',
        paymentStatus: order.paymentStatus,
        paymentRequired: true
      });
    }

    if (order.paymentStatus === 'failed') {
      return res.status(400).json({ 
        message: 'Cannot assign courier to order with failed payment. Order is cancelled.',
        paymentStatus: 'failed',
        orderStatus: 'cancelled'
      });
    }

    // Try to resolve restaurant location from first dish
    const Dish = require('../models/Dish');
    const Restaurant = require('../models/Restaurant');

    const firstDish = order.items && order.items.length ? order.items[0] : null;
    if (!firstDish) return res.status(400).json({ message: 'Order has no items' });

    const dish = await Dish.findById(firstDish.dish);
    if (!dish) return res.status(400).json({ message: 'Dish or restaurant not found' });

    const restaurant = await Restaurant.findById(dish.restaurant);
    if (!restaurant || !restaurant.location || restaurant.location.lat === undefined || restaurant.location.lng === undefined) {
      return res.status(400).json({ message: 'Restaurant location unknown; cannot auto-assign' });
    }

    const lat = Number(restaurant.location.lat);
    const lng = Number(restaurant.location.lng);

    // Find nearest available courier using GeoJSON near query
    const Courier = require('../models/Courier');
    const nearest = await Courier.find({
      available: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: Number(req.query.maxDistance) || 10000,
        },
      },
    }).limit(1);

    if (!nearest || nearest.length === 0) return res.status(404).json({ message: 'No available couriers nearby' });

    const courier = nearest[0];

    // Assign courier to order (snapshot) and reference
    order.courier = {
      id: courier._id,
      name: courier.name,
      phone: courier.phone,
      vehicleType: courier.vehicleType,
      rating: courier.rating,
    };
    order.courierRef = courier._id;
    order.deliveryAssigned = true;
    // Mark as assigned; courier must accept to change to 'accepted'
    order.status = 'assigned';

    await order.save();

    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user.toString(), 'order:assigned', { order: order.toObject() });
      realtime.broadcastToUser(courier.user?.toString() || courier._id.toString(), 'job:assigned', { order: order.toObject() });
    } catch (e) {}

    res.json({ ok: true, order });
  } catch (error) {
    console.error('assignNearestCourier error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Cancel order - accessible to user (for their own orders) or admin
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const orderId = req.params.id;

    // Fetch the order
    const order = await Order.findById(orderId)
      .populate('user', 'name email')
      .populate('items.dish', 'name image');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Check authorization: user can cancel their own orders, admin can cancel any
    const orderUserId = order.user._id || order.user;
    const requestUserId = req.user.id;
    
    console.log('Cancel order auth check:', {
      orderUserId: orderUserId.toString(),
      requestUserId: requestUserId.toString(),
      userRole: req.user.role,
      match: orderUserId.toString() === requestUserId.toString()
    });

    if (orderUserId.toString() !== requestUserId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Cannot cancel if already delivered or cancelled
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({ 
        message: `Cannot cancel an order that is already ${order.status}` 
      });
    }

    // Update order status to cancelled
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = req.user.role === 'admin' ? 'admin' : 'user';
    order.cancellationReason = reason || 'No reason provided';

    await order.save();

    // Broadcast cancellation event via realtime service
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user._id.toString(), 'order:cancelled', { order: order.toObject() });
      realtime.broadcastToAdmins('order:cancelled', { order: order.toObject() });
      
      // Create notification for admins
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          type: 'order_cancelled',
          user: req.user.id,
          data: order.toObject(),
          forAdmins: true,
        });
      } catch (nerr) {
        console.warn('Failed to create cancellation notification', nerr.message || nerr);
      }
    } catch (e) {
      try {
        const { sendEvent } = require('../utils/stream');
        sendEvent('order_cancelled', { order: order.toObject() });
      } catch (er) {}
    }

    res.json({ 
      message: 'Order cancelled successfully',
      order 
    });
  } catch (error) {
    console.error('cancelOrder error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateTracking,
  assignNearestCourier,
  cancelOrder,
};
