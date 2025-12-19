require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Dish = require('../src/models/Dish');
const Order = require('../src/models/Order');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/swadhan-eats';

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  // Find a dish
  const dish = await Dish.findOne();
  if (!dish) {
    console.error('No dish found in DB. Please create a restaurant and a dish first.');
    process.exit(1);
  }

  // Find or create a test user
  let user = await User.findOne({ email: 'testuser@example.com' });
  if (!user) {
    user = new User({ name: 'Test User', email: 'testuser@example.com', password: 'password123', role: 'user' });
    await user.save();
    console.log('Created test user:', user.email);
  }

  const order = new Order({
    user: user._id,
    items: [{ dish: dish._id, name: dish.name, qty: 1, price: dish.price }],
    totalPrice: dish.price,
    address: '123 Test Street',
    city: 'Test City',
    status: 'pending'
  });

  await order.save();
  console.log('Created order:', order._id.toString());
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
