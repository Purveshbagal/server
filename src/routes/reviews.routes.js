const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth.middleware');
const {
  createReview,
  getReviews,
  updateReview,
  deleteReview,
} = require('../controllers/reviews.controller');

// All routes require authentication
router.use(auth);

// Create a review
router.post('/', createReview);

// Get reviews for a target (restaurant or dish)
router.get('/:targetType/:targetId', getReviews);

// Update a review (only by review owner)
router.put('/:id', updateReview);

// Delete a review (only by review owner)
router.delete('/:id', deleteReview);

module.exports = router;
