const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    dish: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dish',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  }],
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
  // Current delivery location (optional)
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  // Delivery tracking history
  deliveryTracking: [{
    status: {
      type: String,
      enum: ['accepted', 'preparing', 'ready-for-pickup', 'picked-up', 'out-for-delivery', 'arriving-soon', 'delivered'],
      required: true,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: { type: String, trim: true },
  }],
  // Assigned courier information
  courier: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    vehicleType: { type: String, enum: ['bike', 'car', 'scooter'], default: 'bike' },
    rating: { type: Number, min: 0, max: 5, default: 0 },
  },
  // Reference to Courier profile (if couriers are modeled separately)
  courierRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Courier',
  },
  deliveryAssigned: {
    type: Boolean,
    default: false,
  },
  // Estimated delivery time
  estimatedDeliveryTime: {
    type: Date,
  },
  // Actual delivery time
  actualDeliveryTime: {
    type: Date,
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'upi', 'card', 'gateway', 'other'],
    default: 'cod',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  paymentInfo: {
    type: Object,
  },
  // Cancellation details
  cancelledAt: {
    type: Date,
  },
  cancelledBy: {
    type: String,
    enum: ['user', 'admin'],
  },
  cancellationReason: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);
