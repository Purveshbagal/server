const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const restaurantRoutes = require('./routes/restaurants.routes');
const dishRoutes = require('./routes/dishes.routes');
const orderRoutes = require('./routes/orders.routes');
const adminRoutes = require('./routes/admin.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const bannerRoutes = require('./routes/banners.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const adminPortalRoutes = require('./routes/adminPortal.routes');
const streamRoutes = require('./routes/stream.routes');
const paymentsRoutes = require('./routes/payments.routes');
const activitiesRoutes = require('./routes/activities.routes');
const devRoutes = require('./routes/dev.routes');
const courierRoutes = require('./routes/couriers.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const { razorpayWebhook } = require('./controllers/payments.controller');

// Import middlewares
const errorHandler = require('./middlewares/errorHandler.middleware');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { sanitizer } = require('./middlewares/sanitizer.middleware');
const { generalLimiter, authLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, or file://)
    if (!origin || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:5173'];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging and sanitization
app.use(requestLogger);
app.use(sanitizer);

// Rate limiting
app.use(generalLimiter);

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/dishes', dishRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/couriers', courierRoutes);
// Dev-only routes (only mount when not in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}
// Dev-only admin portal for direct DB entries (simple HTML form)
app.use('/admin-portal', adminPortalRoutes);
// SSE stream for real-time updates (development only)
app.use('/api/stream', streamRoutes);

// Razorpay webhook: use raw body for signature verification
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  return razorpayWebhook(req, res, next);
});

// Mount payments routes (use JSON body parser for other payment endpoints)
app.use('/api/payments', express.json(), paymentsRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found', errorCode: 'NOT_FOUND' });
});

module.exports = app;
