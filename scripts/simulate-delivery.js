/**
 * Simulate delivery for a given order id.
 * Usage: node scripts/simulate-delivery.js <orderId>
 * Make sure `MONGO_URI` is set in environment (or in .env) before running.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const Order = require('../src/models/Order');
const Dish = require('../src/models/Dish');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/swadhan-eats';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function simulate(orderId) {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const order = await Order.findById(orderId).populate('items.dish');
  if (!order) {
    console.error('Order not found:', orderId);
    process.exit(1);
  }

  // Try to get restaurant location from first dish
  let start = { lat: 20.5937, lng: 78.9629 };
  try {
    const firstDish = await Dish.findById(order.items[0].dish).populate('restaurant');
    if (firstDish && firstDish.restaurant && firstDish.restaurant.location && firstDish.restaurant.location.lat && firstDish.restaurant.location.lng) {
      start = { lat: firstDish.restaurant.location.lat, lng: firstDish.restaurant.location.lng };
    }
  } catch (e) {
    // ignore
  }

  // Destination: random offset from start (simulate user location)
  const dest = { lat: start.lat + (Math.random() * 0.06 - 0.03), lng: start.lng + (Math.random() * 0.06 - 0.03) };

  console.log('Simulating delivery from', start, 'to', dest);

  const BASE = process.env.BASE_URL || 'http://localhost:3000';
  const ADMIN_SECRET = process.env.ADMIN_PORTAL_PASSWORD || process.env.ADMIN_PORTAL_SECRET || 'purvesh';

  async function postStatus(status) {
    const url = `${BASE}/admin-portal/orders/${orderId}/status`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-portal-secret': ADMIN_SECRET },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Failed to post status', status, res.status, txt);
    } else {
      const j = await res.json().catch(() => null);
      console.log('Posted status', status, j || 'ok');
    }
  }

  async function postTrack(lat, lng, courierName, courierPhone) {
    const url = `${BASE}/admin-portal/orders/${orderId}/track`;
    const body = { lat, lng };
    if (courierName) body.courierName = courierName;
    if (courierPhone) body.courierPhone = courierPhone;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-portal-secret': ADMIN_SECRET },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Failed to post track', res.status, txt);
    } else {
      const j = await res.json().catch(() => null);
      console.log('Posted track', j || 'ok');
    }
  }

  // Steps: accepted -> preparing -> out-for-delivery -> move -> delivered
  await postStatus('accepted');
  await sleep(3000);
  await postStatus('preparing');
  await sleep(4000);
  await postStatus('out-for-delivery');
  await postTrack(start.lat, start.lng, 'Demo Rider', '7000000000');

  // Move from start to dest in N steps
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const lat = start.lat + (dest.lat - start.lat) * t;
    const lng = start.lng + (dest.lng - start.lng) * t;
    await postTrack(lat, lng);
    await sleep(3000);
  }

  await postStatus('delivered');
  await postTrack(dest.lat, dest.lng);
  console.log('Delivery simulation complete');
  process.exit(0);
}

(async () => {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('Usage: node scripts/simulate-delivery.js <orderId>');
    process.exit(1);
  }
  try {
    await simulate(orderId);
  } catch (err) {
    console.error('Simulation failed:', err);
    process.exit(1);
  }
})();
