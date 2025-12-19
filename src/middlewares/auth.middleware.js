const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    req.user = { id: user._id, role: user.role, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Authorization middleware generator: authorize roles (array)
const authorize = (roles = []) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Access denied. No user.' });
  if (roles.length && !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied. Insufficient role.' });
  }
  next();
};

// Export authenticate as the default function, and attach helpers for named imports
module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
module.exports.auth = authenticate;
