const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment } = require('../controllers/payments.controller');
const auth = require('../middlewares/auth.middleware');

/**
 * Payment Routes
 * 
 * POST /api/payment/create-order - Create Razorpay order (requires auth)
 * POST /api/payment/verify - Verify Razorpay payment signature (requires auth)
 */

// Create Razorpay order
// Input: { orderId }
// Returns: Razorpay order object with key
router.post('/create-order', auth, createRazorpayOrder);

// Verify Razorpay payment
// Input: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
// Returns: Success/failure status
router.post('/verify', auth, verifyRazorpayPayment);

module.exports = router;
