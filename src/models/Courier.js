const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  vehicleType: { type: String, enum: ['bike', 'car', 'scooter'], default: 'bike' },
  available: { type: Boolean, default: true },
  status: { type: String, enum: ['idle', 'assigned', 'picking', 'delivering', 'off-duty'], default: 'idle' },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  earnings: { type: Number, default: 0 },
  // GeoJSON point for geospatial queries: [lng, lat]
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  lastSeenAt: { type: Date },
  meta: { type: Object },
}, {
  timestamps: true,
});

// Create 2dsphere index for location queries
courierSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Courier', courierSchema);
