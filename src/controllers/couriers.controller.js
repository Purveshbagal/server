const Courier = require('../models/Courier');
const Joi = require('joi');

// Get courier profile for authenticated user
const getMe = async (req, res) => {
  try {
    const courier = await Courier.findOne({ user: req.user.id });
    if (!courier) return res.status(404).json({ message: 'Courier profile not found' });
    res.json(courier);
  } catch (error) {
    console.error('getMe error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Courier accepts assigned job
const acceptJob = async (req, res) => {
  try {
    const { id, orderId } = req.params; // id is courier id
    const courier = await Courier.findById(id);
    if (!courier) return res.status(404).json({ message: 'Courier not found' });

    // Ensure courier belongs to authenticated user or admin
    if (courier.user && courier.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Order = require('../models/Order');
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Ensure order was assigned to this courier
    if (!order.courierRef || order.courierRef.toString() !== courier._id.toString()) {
      return res.status(400).json({ message: 'Order not assigned to this courier' });
    }

    // Accept the job
    order.status = 'accepted';
    order.deliveryAssigned = true;
    order.courier = {
      id: courier._id,
      name: courier.name,
      phone: courier.phone,
      vehicleType: courier.vehicleType,
      rating: courier.rating,
    };
    await order.save();

    // Mark courier as not available
    courier.available = false;
    courier.status = 'delivering';
    await courier.save();

    // Notify order owner and admins
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user.toString(), 'order:accepted', { order: order.toObject() });
      realtime.broadcastToUser(req.user.id, 'job:accepted', { order: order.toObject() });
      realtime.broadcastToAdmins('order:status_changed', { order: order.toObject() });
    } catch (e) {}

    res.json({ ok: true, order });
  } catch (error) {
    console.error('acceptJob error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Courier rejects assigned job (makes courier available again and backfills)
const rejectJob = async (req, res) => {
  try {
    const { id, orderId } = req.params;
    const courier = await Courier.findById(id);
    if (!courier) return res.status(404).json({ message: 'Courier not found' });

    if (courier.user && courier.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const Order = require('../models/Order');
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!order.courierRef || order.courierRef.toString() !== courier._id.toString()) {
      return res.status(400).json({ message: 'Order not assigned to this courier' });
    }

    // Remove courier assignment and mark order back to pending (or cancelled by courier)
    order.courier = null;
    order.courierRef = null;
    order.deliveryAssigned = false;
    order.status = 'pending';
    await order.save();

    // Make courier available again
    courier.available = true;
    courier.status = 'idle';
    await courier.save();

    // Notify admin / order owner
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToUser(order.user.toString(), 'order:unassigned', { order: order.toObject() });
      realtime.broadcastToAdmins('order:status_changed', { order: order.toObject() });
    } catch (e) {}

    res.json({ ok: true, order });
  } catch (error) {
    console.error('rejectJob error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create or update courier profile (linked to authenticated user)
const upsertCourier = async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().optional(),
      vehicleType: Joi.string().valid('bike', 'car', 'scooter').optional(),
      available: Joi.boolean().optional(),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, phone, vehicleType, available } = req.body;

    // If courier profile exists for this user, update it
    let courier = await Courier.findOne({ user: req.user.id });
    if (courier) {
      courier.name = name || courier.name;
      if (phone) courier.phone = phone;
      if (vehicleType) courier.vehicleType = vehicleType;
      if (available !== undefined) courier.available = available;
      await courier.save();
      return res.json(courier);
    }

    // Create new courier profile
    courier = new Courier({
      user: req.user.id,
      name,
      phone,
      vehicleType,
      available: available === undefined ? true : available,
    });

    await courier.save();
    res.status(201).json(courier);
  } catch (error) {
    console.error('upsertCourier error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update courier location and small status fields
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, available, status } = req.body;
    const courierId = req.params.id;

    const update = {};
    if (lat !== undefined && lng !== undefined) {
      update.location = { type: 'Point', coordinates: [Number(lng), Number(lat)] };
      update.lastSeenAt = new Date();
    }
    if (available !== undefined) update.available = Boolean(available);
    if (status) update.status = status;

    const courier = await Courier.findByIdAndUpdate(courierId, update, { new: true });
    if (!courier) return res.status(404).json({ message: 'Courier not found' });

    // Optionally broadcast courier location to interested systems (via realtime service)
    try {
      const realtime = require('../utils/realtimeActivityService');
      realtime.broadcastToAdmins('courier:location', { courier: courier.toObject() });
      realtime.broadcastToUser(req.user.id, 'courier:location', { courier: courier.toObject() });
    } catch (e) {}

    res.json(courier);
  } catch (error) {
    console.error('updateLocation error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Find nearby available couriers
const findNearby = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const maxDistance = Number(req.query.maxDistance) || 5000; // meters

    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ message: 'lat and lng required' });

    const couriers = await Courier.find({
      available: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistance,
        },
      },
    }).limit(20);

    res.json({ count: couriers.length, couriers });
  } catch (error) {
    console.error('findNearby error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get courier by id
const getCourier = async (req, res) => {
  try {
    const courier = await Courier.findById(req.params.id);
    if (!courier) return res.status(404).json({ message: 'Courier not found' });
    res.json(courier);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { upsertCourier, updateLocation, findNearby, getCourier, getMe, acceptJob, rejectJob };
