ess// Utility functions for calculating and updating ratings

const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const Dish = require('../models/Dish');

/**
 * Update average rating and review count for a target (restaurant or dish)
 * @param {string} targetType - 'restaurant' or 'dish'
 * @param {string} targetId - ObjectId of the target
 */
const updateAverageRating = async (targetType, targetId) => {
  try {
    // Get all reviews for this target
    const reviews = await Review.find({ targetType, targetId });

    if (reviews.length === 0) {
      // No reviews, reset to 0
      const update = { averageRating: 0, reviewCount: 0 };
      if (targetType === 'restaurant') {
        await Restaurant.findByIdAndUpdate(targetId, update);
      } else if (targetType === 'dish') {
        await Dish.findByIdAndUpdate(targetId, update);
      }
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 10) / 10; // Round to 1 decimal

    const update = {
      averageRating,
      reviewCount: reviews.length,
    };

    if (targetType === 'restaurant') {
      await Restaurant.findByIdAndUpdate(targetId, update);
    } else if (targetType === 'dish') {
      await Dish.findByIdAndUpdate(targetId, update);
    }
  } catch (error) {
    console.error('Error updating average rating:', error);
  }
};

module.exports = {
  updateAverageRating,
};
