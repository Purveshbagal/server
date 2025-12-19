const express = require('express');
const {
  getAllActivities,
  getActivityStats,
  getRecentActivities,
  getUserActivities,
  getAdminActivities,
  getRestaurantActivities,
  getDashboardStats,
  getActivity,
  cleanupOldActivities,
} = require('../controllers/activities.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = auth || {};
const authMiddleware = typeof auth === 'function' ? auth : (auth && auth.authenticate) || (auth && auth.default) || ((req, res, next) => next());

const router = express.Router();

// Public routes
router.get('/recent', getRecentActivities);

// Protected routes
console.log('DEBUG auth in activities.routes:', typeof auth, 'authMiddleware type:', typeof authMiddleware);
router.use(authMiddleware);

// User activities
router.get('/user/activities', getUserActivities);
router.get('/user/dashboard', getDashboardStats);

// Get single activity
router.get('/:activityId', getActivity);

// Admin routes
router.use(authorize(['admin']));

router.get('/', getAllActivities);
router.get('/stats/overview', getActivityStats);
router.get('/admin/activities', getAdminActivities);
router.get('/restaurant/:restaurantId/activities', getRestaurantActivities);
router.delete('/cleanup', cleanupOldActivities);

module.exports = router;
