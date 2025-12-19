const Activity = require('../models/Activity');
const logger = require('../utils/logger');

class ActivityTracker {
  static async trackActivity(options) {
    try {
      const {
        type,
        userId,
        adminId,
        restaurantId,
        dishId,
        orderId,
        description,
        details = {},
        status = 'COMPLETED',
        severity = 'INFO',
        ipAddress,
        userAgent,
        duration,
        isPublic = true,
      } = options;

      const activity = new Activity({
        type,
        user: userId,
        admin: adminId,
        restaurant: restaurantId,
        dish: dishId,
        order: orderId,
        description,
        details,
        status,
        severity,
        ipAddress,
        userAgent,
        duration,
        isPublic,
      });

      await activity.save();

      logger.info('Activity tracked', {
        type,
        description,
        userId,
        adminId,
      });

      return activity;
    } catch (error) {
      logger.error('Error tracking activity', {
        error: error.message,
        type: options?.type,
      });
      throw error;
    }
  }

  static async getActivities(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = '-createdAt',
      } = options;

      const skip = (page - 1) * limit;

      const query = Activity.find(filters)
        .populate('user', 'name email')
        .populate('admin', 'name email')
        .populate('restaurant', 'name')
        .populate('dish', 'name')
        .sort(sortBy)
        .skip(skip)
        .limit(limit);

      const [activities, total] = await Promise.all([
        query.exec(),
        Activity.countDocuments(filters),
      ]);

      return {
        activities,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error fetching activities', {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  static async getActivityStats(filters = {}) {
    try {
      const stats = await Activity.aggregate([
        { $match: filters },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      const severityStats = await Activity.aggregate([
        { $match: filters },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 },
          },
        },
      ]);

      const statusStats = await Activity.aggregate([
        { $match: filters },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        byType: stats,
        bySeverity: severityStats,
        byStatus: statusStats,
      };
    } catch (error) {
      logger.error('Error calculating activity stats', {
        error: error.message,
      });
      throw error;
    }
  }

  static async getRecentActivities(limit = 10) {
    try {
      const activities = await Activity.find({ isPublic: true })
        .populate('user', 'name')
        .populate('restaurant', 'name')
        .sort({ createdAt: -1 })
        .limit(limit);

      return activities;
    } catch (error) {
      logger.error('Error fetching recent activities', {
        error: error.message,
      });
      throw error;
    }
  }

  static async getUserActivities(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        Activity.find({ user: userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Activity.countDocuments({ user: userId }),
      ]);

      return {
        activities,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error fetching user activities', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  static async getAdminActivities(adminId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        Activity.find({ admin: adminId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Activity.countDocuments({ admin: adminId }),
      ]);

      return {
        activities,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error fetching admin activities', {
        error: error.message,
        adminId,
      });
      throw error;
    }
  }

  static async getRestaurantActivities(restaurantId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const [activities, total] = await Promise.all([
        Activity.find({ restaurant: restaurantId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Activity.countDocuments({ restaurant: restaurantId }),
      ]);

      return {
        activities,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error fetching restaurant activities', {
        error: error.message,
        restaurantId,
      });
      throw error;
    }
  }

  static async getDashboardStats(adminId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayFilter = { createdAt: { $gte: today } };
      const adminFilter = { ...todayFilter, admin: adminId };

      const [
        totalActivities,
        adminActivities,
        errorCount,
        warningCount,
      ] = await Promise.all([
        Activity.countDocuments(todayFilter),
        Activity.countDocuments(adminFilter),
        Activity.countDocuments({ ...todayFilter, severity: 'ERROR' }),
        Activity.countDocuments({ ...todayFilter, severity: 'WARNING' }),
      ]);

      return {
        totalActivities,
        adminActivities,
        errors: errorCount,
        warnings: warningCount,
      };
    } catch (error) {
      logger.error('Error calculating dashboard stats', {
        error: error.message,
        adminId,
      });
      throw error;
    }
  }
}

module.exports = ActivityTracker;
