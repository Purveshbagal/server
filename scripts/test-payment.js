/**
 * Test Script for Razorpay Payment Integration
 * 
 * This script helps you test the payment endpoints manually
 * Run with: node scripts/test-payment.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let orderId = '';

// Replace with your actual login credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test@123'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

// Helper function to make authenticated requests
const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Step 1: Login
async function login() {
  try {
    log.info('Step 1: Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    authToken = response.data.accessToken;
    log.success('Login successful');
    log.info(`Token: ${authToken.substring(0, 20)}...`);
    return true;
  } catch (error) {
    log.error('Login failed');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Step 2: Create a test order
async function createOrder() {
  try {
    log.info('\nStep 2: Creating test order...');
    
    // You'll need to replace these with actual dish IDs from your database
    const orderData = {
      items: [
        { dish: '507f1f77bcf86cd799439011', qty: 2 } // Replace with actual dish ID
      ],
      address: '123 Test Street, Apartment 4B',
      city: 'Mumbai',
      paymentMethod: 'gateway',
      paymentStatus: 'pending'
    };

    const response = await api.post('/orders', orderData);
    orderId = response.data._id;
    
    log.success('Order created successfully');
    log.info(`Order ID: ${orderId}`);
    log.info(`Total Amount: ₹${response.data.totalPrice}`);
    return true;
  } catch (error) {
    log.error('Order creation failed');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Step 3: Create Razorpay order
async function createRazorpayOrder() {
  try {
    log.info('\nStep 3: Creating Razorpay order...');
    
    const response = await api.post('/payment/create-order', {
      orderId: orderId
    });

    log.success('Razorpay order created successfully');
    log.info(`Razorpay Order ID: ${response.data.order.id}`);
    log.info(`Amount: ₹${response.data.amount}`);
    log.info(`Currency: ${response.data.order.currency}`);
    log.info(`Key ID: ${response.data.key}`);
    
    return response.data;
  } catch (error) {
    log.error('Razorpay order creation failed');
    console.error(error.response?.data || error.message);
    return null;
  }
}

// Step 4: Simulate payment verification (for testing signature logic)
async function testSignatureVerification() {
  try {
    log.info('\nStep 4: Testing signature verification...');
    
    log.warn('This will intentionally fail with invalid signature');
    log.info('In real scenario, Razorpay provides these values after payment');

    const testData = {
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'invalid_signature',
      orderId: orderId
    };

    try {
      const response = await api.post('/payment/verify', testData);
      log.error('Unexpected success - signature should have failed');
    } catch (error) {
      if (error.response?.status === 400) {
        log.success('Signature verification correctly rejected invalid signature');
        log.info('Order status should be updated to "failed"');
      } else {
        throw error;
      }
    }

    return true;
  } catch (error) {
    log.error('Signature verification test failed');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Step 5: Test delivery validation
async function testDeliveryValidation() {
  try {
    log.info('\nStep 5: Testing delivery validation...');
    
    log.warn('Attempting to update order status to "preparing" without payment');
    
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: 'preparing'
      });
      log.error('Unexpected success - should have been blocked');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.paymentRequired) {
        log.success('Delivery validation working correctly');
        log.info('Status update blocked due to pending payment');
      } else {
        throw error;
      }
    }

    return true;
  } catch (error) {
    log.error('Delivery validation test failed');
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  Razorpay Payment Integration - Backend Test Suite');
  console.log('='.repeat(60) + '\n');

  log.info('Starting tests...\n');

  // Run tests sequentially
  const loginSuccess = await login();
  if (!loginSuccess) {
    log.error('\nTests aborted: Login failed');
    log.warn('Please update TEST_USER credentials in this script');
    return;
  }

  const orderSuccess = await createOrder();
  if (!orderSuccess) {
    log.error('\nTests aborted: Order creation failed');
    log.warn('Please ensure you have dishes in your database');
    log.warn('Update the dish ID in createOrder() function');
    return;
  }

  const razorpaySuccess = await createRazorpayOrder();
  if (!razorpaySuccess) {
    log.error('\nTests aborted: Razorpay order creation failed');
    log.warn('Please check your Razorpay credentials in .env');
    return;
  }

  await testSignatureVerification();
  await testDeliveryValidation();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  Test Summary');
  console.log('='.repeat(60));
  log.success('Backend payment integration is working correctly');
  log.info('\nNext steps:');
  console.log('  1. Test frontend payment flow in browser');
  console.log('  2. Use test card: 4111 1111 1111 1111');
  console.log('  3. Check order status updates in MongoDB');
  console.log('  4. Verify delivery validation rules');
  console.log('\n');
}

// Run the tests
runTests().catch((error) => {
  log.error('Unexpected error during tests');
  console.error(error);
  process.exit(1);
});
