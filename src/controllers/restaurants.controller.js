const Joi = require('joi');
const Restaurant = require('../models/Restaurant');
const Dish = require('../models/Dish');

// Validation schemas
const restaurantSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  city: Joi.string().required(),
  address: Joi.string().required(),
  cuisine: Joi.array().items(Joi.string()).optional(),
  location: Joi.object({ lat: Joi.number().optional(), lng: Joi.number().optional() }).optional(),
});

// Partial update schema (allow updating one or more fields)
const restaurantUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  city: Joi.string().optional(),
  address: Joi.string().optional(),
  cuisine: Joi.array().items(Joi.string()).optional(),
  location: Joi.object({ lat: Joi.number().optional(), lng: Joi.number().optional() }).optional(),
});

// Get restaurants with advanced filters and pagination (only admin-created) - Public endpoint
const getRestaurants = async (req, res) => {
  try {
    const {
      city, q, cuisine, page = 1, limit = 10,
      priceRange, rating, deliveryTime, dietary,
      sortBy = 'createdAt', sortOrder = 'desc',
      lat, lng, radius = 10
    } = req.query;

    const query = {};
    const sortOptions = {};

    // Basic filters
    if (city) query.city = new RegExp(city, 'i');
    if (q) query.name = new RegExp(q, 'i');
    if (cuisine) query.cuisine = { $in: cuisine.split(',') };

    // Price range filter (assuming dishes have price ranges)
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number);
      // This would require a more complex query to check dish prices
      // For now, we'll implement a basic version
    }

    // Rating filter
    if (rating) {
      const minRating = Number(rating);
      query.averageRating = { $gte: minRating };
    }

    // Delivery time filter (assuming restaurants have delivery time estimates)
    if (deliveryTime) {
      const maxTime = Number(deliveryTime);
      query.deliveryTime = { $lte: maxTime };
    }

    // Dietary preferences filter
    if (dietary) {
      const dietaryOptions = dietary.split(',');
      // This would require checking if restaurants have dishes matching dietary preferences
      // For now, we'll implement a basic version
    }

    // Location-based search
    if (lat && lng) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      const radiusKm = Number(radius);

      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radiusKm * 1000 // Convert to meters
        }
      };
    }

    // Filter by restaurants created by admins
    const adminUsers = await require('../models/User').find({ role: 'admin' }).select('_id');
    const adminIds = adminUsers.map(user => user._id);
    query.createdBy = { $in: adminIds };

    // Sort options
    const validSortFields = ['name', 'createdAt', 'averageRating', 'deliveryTime'];
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions.createdAt = -1; // Default sort
    }

    const restaurants = await Restaurant.find(query)
      .populate('createdBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortOptions);

    const total = await Restaurant.countDocuments(query);

    res.json({
      restaurants,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      filters: {
        applied: {
          city, q, cuisine, priceRange, rating, deliveryTime, dietary,
          location: lat && lng ? { lat, lng, radius } : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get admin's own restaurants
const getAdminRestaurants = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const restaurants = await Restaurant.find({ createdBy: req.user.id })
      .populate('createdBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Restaurant.countDocuments({ createdBy: req.user.id });

    res.json({
      restaurants,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single restaurant
const getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate('createdBy', 'name email role');
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    // Only expose restaurant details if it was created by an admin
    if (!restaurant.createdBy || restaurant.createdBy.role !== 'admin') {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const dishCount = await Dish.countDocuments({ restaurant: req.params.id });

    res.json({ ...restaurant.toObject(), dishCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create restaurant
const createRestaurant = async (req, res) => {
  try {
    // Normalize cuisine: accept comma-separated string, single string, or array.
    // Use `typeof` check so empty string values are normalized (instead of skipped).
    const body = { ...req.body };
    // Accept JSON string for location when sent via FormData
    if (typeof body.location === 'string') {
      try { body.location = JSON.parse(body.location); } catch (e) { /* ignore */ }
    }
    if (typeof body.cuisine !== 'undefined') {
      if (Array.isArray(body.cuisine)) {
        body.cuisine = body.cuisine.map(s => String(s).trim()).filter(Boolean);
      } else {
        const raw = String(body.cuisine || '');
        const items = raw.split(',').map(s => s.trim()).filter(Boolean);
        body.cuisine = items;
      }
    }

    const { error } = restaurantSchema.validate(body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, description, city, address, cuisine, location } = body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const restaurant = new Restaurant({
      name,
      description,
      city,
      address,
      cuisine,
      imageUrl,
      location: location ? { lat: Number(location.lat), lng: Number(location.lng) } : undefined,
      createdBy: req.user.id,
    });

    await restaurant.save();
    // Broadcast creation event for SSE clients (dev)
    try {
      const { sendEvent } = require('../utils/stream');
      sendEvent('restaurant_created', { restaurant });
    } catch (e) {
      // ignore if stream not available
    }

    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update restaurant
const updateRestaurant = async (req, res) => {
  try {
    // Normalize cuisine for updates too. Handle empty-string and repeated fields.
    const body = { ...req.body };
    // Accept JSON string for location when sent via FormData
    if (typeof body.location === 'string') {
      try { body.location = JSON.parse(body.location); } catch (e) { /* ignore */ }
    }
    if (typeof body.cuisine !== 'undefined') {
      if (Array.isArray(body.cuisine)) {
        body.cuisine = body.cuisine.map(s => String(s).trim()).filter(Boolean);
      } else {
        const raw = String(body.cuisine || '');
        const items = raw.split(',').map(s => s.trim()).filter(Boolean);
        body.cuisine = items;
      }
    }

    const { error } = restaurantUpdateSchema.validate(body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, description, city, address, cuisine, location } = body;
    const updateData = {};
    if (typeof name !== 'undefined') updateData.name = name;
    if (typeof description !== 'undefined') updateData.description = description;
    if (typeof city !== 'undefined') updateData.city = city;
    if (typeof address !== 'undefined') updateData.address = address;
    if (typeof cuisine !== 'undefined') updateData.cuisine = cuisine;
    if (typeof location !== 'undefined') {
      updateData.location = {
        lat: location.lat !== undefined ? Number(location.lat) : undefined,
        lng: location.lng !== undefined ? Number(location.lng) : undefined,
      };
    }

    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;

    const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete restaurant
const deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    // Delete associated dishes
    await Dish.deleteMany({ restaurant: req.params.id });

    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getRestaurants,
  getAdminRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
};
