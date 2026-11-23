// Pruebas de registro, inicio de sesión y sesiones contra una base MongoDB
// LOCAL y exclusiva de pruebas. Antes apuntaba a COSMOS_CONNECTION_STRING (la
// base real en la nube) y además ya no pasaba: el registro exige el correo
// verificado.
//
// Base: TEST_MONGODB_URI (por defecto mongodb://127.0.0.1:27017) y la base
// SafeRide-Jest, que se vacía al terminar. Se niega a correr contra un
// servidor que no sea local, para que nunca toque datos reales.
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-secret-solo-para-pruebas';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { User, VerificationCode } = require('../models');

const MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'SafeRide-Jest';
const tag = Date.now().toString(36);
const email = `qa.jest.${tag}@intel.com`;
const password = 'Test@1234';

const userBody = (over = {}) => ({
  name: 'Usuario de Prueba',
  username: `qa_jest_${tag}`,
  email,
  phone: '88881111',
  password,
  company: 'Intel',
  work_schedule: '8-5',
  type: 'pasajero',
  ...over,
});

// Equivale a send-verification-code + verify-code (sin mandar correo).
const markEmailVerified = (address) => VerificationCode.create({
  email: address,
  code: '123456',
  verifiedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
});

describe('Auth: registro, inicio de sesión y sesiones', () => {
  let tokens;

  beforeAll(async () => {
    const host = new URL(MONGO_URI.replace(/^mongodb(\+srv)?:/, 'http:')).hostname;
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error(`auth.tests solo corre contra MongoDB local (recibió ${host})`);
    }
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 5000 });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === DB_NAME) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it('rechaza el registro si el correo no se verificó', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(userBody());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('registra al usuario con el correo verificado y consume el código', async () => {
    await markEmailVerified(email);
    const res = await request(app).post('/api/v1/auth/register').send(userBody());
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(await VerificationCode.countDocuments({ email })).toBe(0);
    // El registro público nunca crea administradores.
    expect((await User.findOne({ email })).type).toBe('pasajero');
  });

  it('no permite registrar el mismo correo dos veces', async () => {
    await markEmailVerified(email);
    const res = await request(app).post('/api/v1/auth/register').send(userBody({ username: `otro_${tag}` }));
    expect(res.statusCode).toBe(409);
  });

  it('inicia sesión con la contraseña correcta', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    tokens = res.body.data;
  });

  it('rechaza una contraseña incorrecta sin decir si el correo existe', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ email, password: 'Otra@1234' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: `nadie.${tag}@intel.com`, password });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('devuelve el perfil con el token y nunca la contraseña', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokens.accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(email);
    expect(JSON.stringify(res.body)).not.toMatch(/password|refreshToken/);
  });

  it('rota el refresh token: el anterior no sirve dos veces', async () => {
    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken });
    const again = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: tokens.refreshToken });
    expect(first.statusCode).toBe(200);
    expect(again.statusCode).toBe(401);
    tokens = first.body.data;
  });

  it('cerrar todas las sesiones invalida el token de acceso vigente', async () => {
    const out = await request(app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${tokens.accessToken}`);
    expect(out.statusCode).toBe(200);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokens.accessToken}`);
    expect(me.statusCode).toBe(401);
  });
});
