const Joi = require('joi');
const User = require('../models/User');

// Validation schema
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  phone: Joi.string().optional(),
  preferences: Joi.object({
    dietary: Joi.array().items(Joi.string()).optional(),
    cuisine: Joi.string().optional(),
    priceRange: Joi.string().valid('budget', 'mid-range', 'premium').optional(),
  }).optional(),
});

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    console.log('Update profile request body:', req.body);
    
    const { error } = updateProfileSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findByIdAndUpdate(req.user.id, req.body, {
      new: true,
      runValidators: true,
    }).select('-password -refreshTokens');

    if (!user) return res.status(404).json({ message: 'User not found' });

    console.log('Profile updated successfully:', user);
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Promote user to admin
const promoteToAdmin = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findByIdAndUpdate(userId, { role: 'admin' }, { new: true }).select('-password -refreshTokens');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User promoted to admin', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user favorites (restaurants and dishes)
const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites.restaurants favorites.dishes');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Add an item to favorites. `type` can be 'restaurant'|'restaurants' or 'dish'|'dishes'
const addToFavorites = async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!id) return res.status(400).json({ message: 'Item id is required' });

    const field = /^rest/.test(type) ? 'restaurants' : /^dish/.test(type) ? 'dishes' : null;
    if (!field) return res.status(400).json({ message: 'Invalid favorites type' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { [`favorites.${field}`]: id } },
      { new: true }
    ).populate('favorites.restaurants favorites.dishes');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Added to favorites', favorites: user.favorites });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove an item from favorites
const removeFromFavorites = async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!id) return res.status(400).json({ message: 'Item id is required' });

    const field = /^rest/.test(type) ? 'restaurants' : /^dish/.test(type) ? 'dishes' : null;
    if (!field) return res.status(400).json({ message: 'Invalid favorites type' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { [`favorites.${field}`]: id } },
      { new: true }
    ).populate('favorites.restaurants favorites.dishes');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Removed from favorites', favorites: user.favorites });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  promoteToAdmin,
  getFavorites,
  addToFavorites,
  removeFromFavorites,
};
