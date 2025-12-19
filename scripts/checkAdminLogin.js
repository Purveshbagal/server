require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@swadhan.test';
const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'Admin@12345';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.log('User not found:', email);
      process.exit(0);
    }
    console.log('User found:', { id: user._id, email: user.email, role: user.role, hasIsAdmin: !!user.isAdmin });

    // Need to load model without lean to use instance method
    const UserModel = require('../src/models/User');
    const realUser = await UserModel.findOne({ email });
    const isMatch = await realUser.comparePassword(password);
    console.log('Password match:', isMatch);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

run();
