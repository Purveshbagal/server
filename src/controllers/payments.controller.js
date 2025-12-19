const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

/**
 * Create Razorpay Order
 * POST /api/payment/create-order
 * Input: { orderId }
 * - Fetch order from DB using orderId
 * - Read totalAmount from order
 * - Create Razorpay order using amount
 * - Save razorpayOrderId in existing order
 * - Set paymentStatus = "PENDING"
 * - Return Razorpay order object
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    
    // Validate input
    if (!orderId) {
      return res.status(400).json({ 
        success: false,
        message: 'orderId is required' 
      });
    }

    // Fetch order from database
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Read Razorpay credentials
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!key_id || !key_secret) {
      return res.status(500).json({ 
        success: false,
        message: 'Razorpay keys not configured' 
      });
    }

    // Initialize Razorpay instance
    const razorpay = new Razorpay({ 
      key_id, 
      key_secret 
    });

    // Create Razorpay order
    const razorpayOrderOptions = {
      amount: Math.round(order.totalPrice * 100), // Convert to paise
      currency: 'INR',
      receipt: String(orderId),
      payment_capture: 1,
    };

    const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

    // Update order with Razorpay order ID and set status to PENDING
    order.paymentStatus = 'pending';
    order.paymentMethod = 'gateway';
    if (!order.paymentInfo) {
      order.paymentInfo = {};
    }
    order.paymentInfo.razorpayOrderId = razorpayOrder.id;
    await order.save();

    // Return Razorpay order object and key
    res.json({ 
      success: true,
      order: razorpayOrder,
      key: key_id,
      amount: order.totalPrice
    });
  } catch (error) {
    console.error('createRazorpayOrder error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message 
    });
  }
};

// Webhook endpoint for Razorpay to notify payments
const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature !== expected) {
      console.warn('Invalid razorpay signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body.event;
    const payload = req.body.payload || {};

    // Handle payment captured
    if (event === 'payment.captured') {
      const payment = payload.payment?.entity || {};
      const receipt = payment?.notes?.receipt || payment?.order_id || null;

      // Try to find order by receipt (we passed our order id as receipt when creating order)
      let order = null;
      if (receipt) {
        order = await Order.findOne({ _id: receipt });
      }

      if (order) {
        order.paymentStatus = 'paid';
        order.paymentMethod = 'gateway';
        order.paymentInfo = payment;
        await order.save();

        // broadcast event
        try {
          const { sendEvent } = require('../utils/stream');
          sendEvent('order_updated', { order: order.toObject() });
        } catch (e) {}
        // Create invoice for the order (if not exists)
        try {
          const { createInvoiceForOrder } = require('./invoices.controller');
          await createInvoiceForOrder(order._id);
        } catch (e) {
          console.error('invoice creation failed', e);
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('razorpayWebhook error', error);
    res.status(500).send('Server error');
  }
};

/**
 * Verify Razorpay Payment
 * POST /api/payment/verify
 * Input:
 *   - razorpay_order_id
 *   - razorpay_payment_id
 *   - razorpay_signature
 *   - orderId
 *
 * - Verify signature using crypto.createHmac("sha256", RAZORPAY_KEY_SECRET)
 * - If signature is VALID:
 *     Update order:
 *       paymentStatus = "PAID"
 *       orderStatus = "CONFIRMED" (status = 'accepted')
 *       razorpayPaymentId saved
 * - If signature is INVALID OR payment failed:
 *     Update order:
 *       paymentStatus = "FAILED"
 *       orderStatus = "CANCELLED" (status = 'cancelled')
 *     Return error
 */
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    
    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: razorpay_payment_id, razorpay_order_id, razorpay_signature, and orderId are required' 
      });
    }

    // Get Razorpay secret
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      return res.status(500).json({ 
        success: false,
        message: 'Razorpay key secret not configured' 
      });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    // Check if signature is valid
    if (generatedSignature !== razorpay_signature) {
      // INVALID SIGNATURE - Mark payment as FAILED and cancel order
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      order.paymentInfo = {
        ...order.paymentInfo,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        failureReason: 'Invalid signature',
        failedAt: new Date()
      };
      await order.save();

      // Broadcast order_updated event
      try {
        const { sendEvent } = require('../utils/stream');
        sendEvent('order_updated', { order: order.toObject() });
      } catch (e) {
        console.error('Failed to broadcast event:', e);
      }

      return res.status(400).json({ 
        success: false,
        message: 'Invalid payment signature. Payment verification failed.',
        order 
      });
    }

    // VALID SIGNATURE - Mark payment as PAID and confirm order
    order.paymentStatus = 'paid';
    order.status = 'accepted'; // CONFIRMED status
    order.paymentMethod = 'gateway';
    order.paymentInfo = {
      ...order.paymentInfo,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paidAt: new Date()
    };
    await order.save();

    // Broadcast order_updated event
    try {
      const { sendEvent } = require('../utils/stream');
      sendEvent('order_updated', { order: order.toObject() });
    } catch (e) {
      console.error('Failed to broadcast event:', e);
    }

    // Create invoice for the order
    try {
      const { createInvoiceForOrder } = require('./invoices.controller');
      await createInvoiceForOrder(order._id);
    } catch (e) {
      console.error('Invoice creation failed:', e);
    }

    res.json({ 
      success: true,
      message: 'Payment verified successfully',
      order 
    });
  } catch (error) {
    console.error('verifyRazorpayPayment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Payment verification failed',
      error: error.message 
    });
  }
};

module.exports = { createRazorpayOrder, verifyRazorpayPayment };
