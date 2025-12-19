const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'USER_REGISTRATION',
        'USER_LOGIN',
        'RESTAURANT_CREATED',
        'RESTAURANT_UPDATED',
        'RESTAURANT_DELETED',
        'DISH_CREATED',
        'DISH_UPDATED',
        'DISH_DELETED',
        'ORDER_PLACED',
        'ORDER_UPDATED',
        'PAYMENT_PROCESSED',
        'USER_VIEWED_RESTAURANT',
        'USER_VIEWED_DISH',
        'USER_ADDED_TO_CART',
        'ADMIN_LOGIN',
        'ADMIN_ACTION',
      ],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: false,
    },
    dish: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dish',
      required: false,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
    },
    description: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED',
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'],
      default: 'INFO',
    },
    ipAddress: String,
    userAgent: String,
    duration: Number, // in milliseconds
    metadata: mongoose.Schema.Types.Mixed,
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ admin: 1, createdAt: -1 });
activitySchema.index({ restaurant: 1, createdAt: -1 });
activitySchema.index({ severity: 1 });
activitySchema.index({ status: 1 });

module.exports = mongoose.model('Activity', activitySchema);
