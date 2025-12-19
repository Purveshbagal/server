const Activity = require('../models/Activity');
const ActivityTracker = require('../utils/activityTracker');
const { NotFoundError } = require('../utils/customErrors');

// Get all activities (admin only)
const getAllActivities = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      severity,
      status,
      startDate,
      endDate,
    } = req.query;

    const filters = {};

    if (type) filters.type = type;
    if (severity) filters.severity = severity;
    if (status) filters.status = status;

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) {
        filters.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.createdAt.$lte = new Date(endDate);
      }
    }

    const result = await ActivityTracker.getActivities(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.activities,
      pagination: {
        current: result.page,
        total: result.pages,
        totalItems: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get activity statistics
const getActivityStats = async (req, res, next) => {
  try {
    const { startDate, endDate, type } = req.query;

    const filters = {};

    if (startDate || endDate) {
      filters.createdAt = {};
      if (startDate) {
        filters.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.createdAt.$lte = new Date(endDate);
      }
    }

    if (type) filters.type = type;

    const stats = await ActivityTracker.getActivityStats(filters);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// Get recent activities (public)
const getRecentActivities = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const activities = await ActivityTracker.getRecentActivities(
      parseInt(limit)
    );

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

// Get user's own activities
const getUserActivities = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await ActivityTracker.getUserActivities(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.activities,
      pagination: {
        current: result.page,
        total: result.pages,
        totalItems: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get admin's activities
const getAdminActivities = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await ActivityTracker.getAdminActivities(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.activities,
      pagination: {
        current: result.page,
        total: result.pages,
        totalItems: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get restaurant activities
const getRestaurantActivities = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await ActivityTracker.getRestaurantActivities(restaurantId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.activities,
      pagination: {
        current: result.page,
        total: result.pages,
        totalItems: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get dashboard stats
const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await ActivityTracker.getDashboardStats(req.user.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// Get single activity
const getActivity = async (req, res, next) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findById(activityId)
      .populate('user')
      .populate('admin')
      .populate('restaurant')
      .populate('dish');

    if (!activity) {
      throw new NotFoundError('Activity not found');
    }

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

// Delete old activities (cleanup)
const cleanupOldActivities = async (req, res, next) => {
  try {
    const { daysOld = 30 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));

    const result = await Activity.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old activities`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllActivities,
  getActivityStats,
  getRecentActivities,
  getUserActivities,
  getAdminActivities,
  getRestaurantActivities,
  getDashboardStats,
  getActivity,
  cleanupOldActivities,
};
