const Joi = require('joi');
const Dish = require('../models/Dish');
const Restaurant = require('../models/Restaurant');

// Validation schemas
const dishSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid('Veg', 'Non Veg', 'Chinese', 'Vada Pav', 'Thali', 'Biryani', 'Pizza').required(),
  available: Joi.boolean().optional(),
});

// Get dishes for a restaurant (public)
const getDishes = async (req, res) => {
  try {
    const restaurantId = req.params.restaurantId || req.params.id || req.query.restaurant;

    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    // Verify restaurant exists and is created by an admin
    const restaurant = await Restaurant.findById(restaurantId).populate('createdBy', 'role');
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    // Only expose dishes for restaurants created by admin users
    if (!restaurant.createdBy || restaurant.createdBy.role !== 'admin') {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const dishes = await Dish.find({ restaurant: restaurantId }).sort({ createdAt: -1 });
    res.json({ dishes });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create dish
const createDish = async (req, res) => {
  try {
    const { error } = dishSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const restaurantId = req.params.restaurantId || req.params.id;
    const { name, description, price, category, available } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId).populate('createdBy', 'role');
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    // Ensure the restaurant was created by an admin (defense-in-depth)
    if (!restaurant.createdBy || restaurant.createdBy.role !== 'admin') {
      return res.status(400).json({ message: 'Cannot add dishes to non-admin restaurant' });
    }

    const dish = new Dish({
      restaurant: restaurantId,
      name,
      description,
      price,
      category,
      imageUrl,
      available: available !== undefined ? available : true,
    });

    await dish.save();
    // Broadcast dish_created event for SSE clients (dev)
    try {
      const { sendEvent } = require('../utils/stream');
      sendEvent('dish_created', { dish: dish.toObject(), restaurantId });
    } catch (e) {
      // ignore if stream not available
    }

    res.status(201).json(dish);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update dish
const updateDish = async (req, res) => {
  try {
    const { error } = dishSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, description, price, available } = req.body;
    const updateData = { name, description, price, available };

    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;

    const dish = await Dish.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!dish) return res.status(404).json({ message: 'Dish not found' });

    res.json(dish);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete dish
const deleteDish = async (req, res) => {
  try {
    const dish = await Dish.findByIdAndDelete(req.params.id);
    if (!dish) return res.status(404).json({ message: 'Dish not found' });

    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDishes,
  createDish,
  updateDish,
  deleteDish,
};
