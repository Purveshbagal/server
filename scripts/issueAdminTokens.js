require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../src/models/User');

const email = process.argv[2] || process.env.ADMIN_EMAIL;

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email });
    if (!user) {
      console.error('User not found:', email);
      process.exit(1);
    }

    const accessToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });

    console.log(JSON.stringify({ accessToken, refreshToken, user: { id: user._id, email: user.email, role: user.role } }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error issuing tokens:', err.message || err);
    process.exit(1);
  }
})();
