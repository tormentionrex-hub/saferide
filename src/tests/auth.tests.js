const request = require('supertest');
const app = require('../app');
const { User } = require('../models');
const mongoose = require('mongoose');

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    // Setup test database connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.COSMOS_CONNECTION_STRING, {
        dbName: 'Safe-RideDB-Test', // Use separate test database
        serverSelectionTimeoutMS: 10000,
        tls: true,
        authMechanism: 'SCRAM-SHA-256',
        retryWrites: false,
      });
    }
  });

  afterAll(async () => {
    // Cleanup test data and close connection
    await User.deleteMany({ email: 'test@example.com' });
    await mongoose.connection.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          username: 'testuser',
          email: 'test@example.com',
          phone: '12345678', // Must be 8 digits (Costa Rican phone format)
          password: 'Test@1234', // Must have uppercase, lowercase, number, special char
          company: 'Intel', // Must be a valid company from enum
          type: 'pasajero',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login existing user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test@1234',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });
  });
});
