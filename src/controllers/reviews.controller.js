const Joi = require('joi');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const Dish = require('../models/Dish');

const createReview = async (req, res) => {
  try {
    const schema = Joi.object({
      targetType: Joi.string().valid('restaurant', 'dish').required(),
      targetId: Joi.string().required(),
      rating: Joi.number().min(1).max(5).required(),
      comment: Joi.string().max(500).allow('', null),
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { targetType, targetId, rating, comment } = req.body;

    // Prevent duplicate review by same user for same target
    const existing = await Review.findOne({ user: req.user.id, targetType, targetId });
    if (existing) return res.status(400).json({ message: 'You have already reviewed this item' });

    const review = new Review({ user: req.user.id, targetType, targetId, rating, comment });
    await review.save();

    // Update target aggregates (simple)
    try {
      if (targetType === 'restaurant') {
        const rest = await Restaurant.findById(targetId);
        if (rest) {
          const stats = await Review.aggregate([
            { $match: { targetType: 'restaurant', targetId: rest._id } },
            { $group: { _id: '$targetId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
          ]);
          if (stats && stats[0]) {
            rest.averageRating = stats[0].avg;
            rest.reviewCount = stats[0].count;
            await rest.save();
          }
        }
      } else if (targetType === 'dish') {
        const dish = await Dish.findById(targetId);
        if (dish) {
          const stats = await Review.aggregate([
            { $match: { targetType: 'dish', targetId: dish._id } },
            { $group: { _id: '$targetId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
          ]);
          if (stats && stats[0]) {
            dish.averageRating = stats[0].avg;
            dish.reviewCount = stats[0].count;
            await dish.save();
          }
        }
      }
    } catch (e) {
      console.error('failed to update aggregates', e);
    }

    res.status(201).json(review);
  } catch (error) {
    console.error('createReview error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getReviews = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const reviews = await Review.find({ targetType, targetId }).populate('user', 'name');
    res.json(reviews);
  } catch (error) {
    console.error('getReviews error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (review.user.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    const { rating, comment } = req.body;
    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();
    res.json(review);
  } catch (error) {
    console.error('updateReview error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    await review.remove();
    res.json({ ok: true });
  } catch (error) {
    console.error('deleteReview error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createReview, getReviews, updateReview, deleteReview };
