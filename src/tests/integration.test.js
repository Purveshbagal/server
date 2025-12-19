const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Dish = require('../models/Dish');

// Test variables
let authToken;
let adminToken;
let userId;
let restaurantId;

describe('API Integration Tests', () => {
  // Setup - Create test users
  beforeAll(async () => {
    // Create regular user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'user@test.com',
        password: 'TestPass@123',
        phone: '9876543210',
        address: 'Test Address',
        city: 'Test City',
      });

    authToken = registerRes.body.accessToken;
    userId = registerRes.body.user.id;

    // Create admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'AdminPass@123',
        phone: '9876543211',
        address: 'Admin Address',
        city: 'Admin City',
      });

    adminToken = adminRes.body.accessToken;

    // Promote to admin
    const user = await User.findById(adminRes.body.user.id);
    user.role = 'admin';
    await user.save();
  });

  describe('Authentication', () => {
    test('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          password: 'NewPass@123',
          phone: '9876543212',
          address: 'New Address',
          city: 'New City',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.role).toBe('user');
    });

    test('should login successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'TestPass@123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe('user@test.com');
    });

    test('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'WrongPassword',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid credentials');
    });
  });

  describe('Restaurant Management', () => {
    test('should create a restaurant as admin', async () => {
      const res = await request(app)
        .post('/api/admin/restaurants')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Restaurant')
        .field('description', 'A test restaurant')
        .field('city', 'Test City')
        .field('address', 'Test Address')
        .field('cuisine', JSON.stringify(['Italian', 'Pizza']))
        .attach('image', Buffer.from('fake image'), 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      restaurantId = res.body.data._id;
    });

    test('should not create restaurant as non-admin', async () => {
      const res = await request(app)
        .post('/api/admin/restaurants')
        .set('Authorization', `Bearer ${authToken}`)
        .field('name', 'Unauthorized Restaurant')
        .field('description', 'Should fail')
        .field('city', 'Test City')
        .field('address', 'Test Address')
        .field('cuisine', JSON.stringify(['Italian']));

      expect(res.status).toBe(403);
    });

    test('should get all restaurants', async () => {
      const res = await request(app).get('/api/restaurants');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should get restaurant by ID', async () => {
      const res = await request(app).get(`/api/restaurants/${restaurantId}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(restaurantId);
    });
  });

  describe('Dish Management', () => {
    test('should create a dish as admin', async () => {
      const res = await request(app)
        .post(`/api/admin/restaurants/${restaurantId}/dishes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Dish')
        .field('description', 'A test dish')
        .field('price', '299')
        .attach('image', Buffer.from('fake image'), 'dish.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
    });

    test('should get dishes for restaurant', async () => {
      const res = await request(app).get(
        `/api/restaurants/${restaurantId}/dishes`
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for invalid route', async () => {
      const res = await request(app).get('/api/invalid-route');

      expect(res.status).toBe(404);
    });

    test('should return 401 without token', async () => {
      const res = await request(app).get('/api/admin/restaurants');

      expect(res.status).toBe(401);
    });

    test('should validate input data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'T', // Too short
          email: 'invalid-email',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('details');
    });
  });
});
