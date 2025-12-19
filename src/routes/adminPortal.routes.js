const express = require('express');
const path = require('path');
const upload = require('../middlewares/upload.middleware');
const router = express.Router();

const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

const ADMIN_PORTAL_PASSWORD = process.env.ADMIN_PORTAL_PASSWORD || 'purvesh';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').map(c => c.trim()).filter(Boolean).reduce((acc, cur) => {
    const [k, v] = cur.split('='); acc[k] = decodeURIComponent(v); return acc;
  }, {});
}

function isAuthed(req) {
  // check header first
  const headerSecret = req.headers['x-admin-portal-secret'];
  if (headerSecret && headerSecret === ADMIN_PORTAL_PASSWORD) return true;
  // check cookie
  const cookies = parseCookies(req);
  if (cookies.admin_portal_auth && cookies.admin_portal_auth === ADMIN_PORTAL_PASSWORD) return true;
  // check query (convenience)
  if (req.query && req.query.secret && req.query.secret === ADMIN_PORTAL_PASSWORD) return true;
  return false;
}

// Serve the static HTML form (protected)
router.get('/', (req, res) => {
  if (!isAuthed(req)) {
    // Serve a simple login page
    return res.send(`<!doctype html><html><head><meta charset="utf-8"/><title>Admin Portal Login</title></head><body><h2>Admin Portal Login</h2><form method="POST" action="/admin-portal/login"><input name="password" type="password" placeholder="Password"/><button type="submit">Login</button></form></body></html>`);
  }
  res.sendFile(path.join(__dirname, '..', '..', 'admin-portal', 'index.html'));
});

// Login endpoint for admin portal (sets a cookie)
router.post('/login', async (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PORTAL_PASSWORD) {
    // set cookie for portal path
    res.cookie('admin_portal_auth', ADMIN_PORTAL_PASSWORD, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'Lax' });
    return res.redirect('/admin-portal/');
  }
  return res.status(401).send('Unauthorized');
});

// Logout clears the cookie
router.get('/logout', (req, res) => {
  res.clearCookie('admin_portal_auth', { path: '/' });
  res.redirect('/admin-portal/');
});

// Create restaurant directly (dev portal)
router.post('/restaurants', upload.single('image'), async (req, res, next) => {
  if (!isAuthed(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const { name, description, city, address, cuisine, adminEmail } = req.body;

    if (!name || !city || !address) {
      return res.status(400).json({ message: 'name, city and address are required' });
    }

    // Find admin by provided email or fallback to env ADMIN_EMAIL
    const lookupEmail = (adminEmail && adminEmail.trim()) || process.env.ADMIN_EMAIL;
    if (!lookupEmail) {
      return res.status(400).json({ message: 'Admin email not provided and ADMIN_EMAIL env missing' });
    }

    const adminUser = await User.findOne({ email: lookupEmail.toLowerCase().trim() });
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found: ' + lookupEmail });
    }

    if (adminUser.role !== 'admin') {
      return res.status(403).json({ message: 'Provided user is not an admin' });
    }

    const newRestaurant = new Restaurant({
      name: name.trim(),
      description: description ? description.trim() : undefined,
      city: city.trim(),
      address: address.trim(),
      cuisine: cuisine ? cuisine.split(',').map(s => s.trim()).filter(Boolean) : [],
      createdBy: adminUser._id,
    });

    if (req.file) {
      newRestaurant.imageUrl = '/uploads/' + req.file.filename;
    }

    await newRestaurant.save();
    res.status(201).json({ message: 'Restaurant created', restaurant: newRestaurant });
  } catch (err) {
    next(err);
  }
});

// Dev-only: list recent orders for admin portal
router.get('/orders', async (req, res, next) => {
  if (!isAuthed(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const Order = require('../models/Order');
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Dev-only: update order status without auth (for local admin portal convenience)
router.post('/orders/:id/status', async (req, res, next) => {
  if (!isAuthed(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const Order = require('../models/Order');
    const { status } = req.body;
    const valid = ['pending', 'accepted', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('user', 'name email _id')
      .populate('items.dish', 'name image price')
      .populate('restaurant', 'name location');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    // emit event
    console.log('Broadcasting order update:', { orderId: order._id, userId: order.user._id, status: order.status });
    try { const { sendEvent } = require('../utils/stream'); sendEvent('order_updated', { order: order.toObject() }); } catch (e) {
      console.error('Failed to broadcast order update:', e);
    }
    res.json({ order });
  } catch (err) { next(err); }
});

// Dev-only: update tracking/location or courier info without auth
router.post('/orders/:id/track', async (req, res, next) => {
  if (!isAuthed(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const Order = require('../models/Order');
    const { lat, lng, courierName, courierPhone } = req.body;
    const update = {};
    if (lat !== undefined && lng !== undefined) update.currentLocation = { lat: Number(lat), lng: Number(lng) };
    if (courierName || courierPhone) { update.courier = {}; if (courierName) update.courier.name = courierName; if (courierPhone) update.courier.phone = courierPhone; update.deliveryAssigned = true; }
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    try { const { sendEvent } = require('../utils/stream'); sendEvent('delivery_updated', { order }); } catch (e) {}
    res.json({ order });
  } catch (err) { next(err); }
});

// Dev-only: trigger delivery simulation for an order (spawns simulator script)
router.post('/simulate/:id', async (req, res, next) => {
  if (!isAuthed(req)) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const { spawn } = require('child_process');
    const orderId = req.params.id;
    const node = process.execPath || 'node';
    const script = path.join(__dirname, '..', '..', 'scripts', 'simulate-delivery.js');
    const child = spawn(node, [script, orderId], { env: Object.assign({}, process.env), stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (d) => { console.log('[simulate] ' + d.toString()); });
    child.stderr.on('data', (d) => { console.error('[simulate-err] ' + d.toString()); });

    child.on('exit', (code) => { console.log(`Simulation process exited ${code}`); });

    return res.json({ message: 'Simulation started', pid: child.pid });
  } catch (err) { next(err); }
});

module.exports = router;
