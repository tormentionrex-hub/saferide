const mongoose = require('mongoose');
const { User, TrustHistory } = require('../models');
const trustService = require('../services/trustService');

// Helper para crear usuarios de test con un sufijo único por suite.
const createUser = (overrides = {}) =>
    User.create({
        name: 'Trust Tester',
        username: `trust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        email: `trust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.com`,
        phone: '12345678',
        password: 'Test@1234',
        company: 'Intel',
        type: 'pasajero',
        ...overrides,
    });

describe('trustService', () => {
    beforeAll(async () => {
        // Conectamos con la misma config que el resto del backend para que
        // los flags de auth (authSource, authMechanism) y TLS apliquen.
        // No llamamos connectDB() directamente porque hace process.exit(1)
        // en error, lo cual mata el runner de jest. Replicamos la lógica
        // mínima aquí para que un fallo de conexión falle el test, no el
        // proceso entero.
        if (mongoose.connection.readyState === 0) {
            let connectionString = process.env.COSMOS_CONNECTION_STRING;
            const dbName = process.env.COSMOS_DATABASE || 'Safe-RideDB';

            if (!connectionString) {
                throw new Error('COSMOS_CONNECTION_STRING is not defined');
            }
            if (!connectionString.includes('?')) {
                connectionString = connectionString.replace(/\/?$/, `/${dbName}?`);
            } else if (!connectionString.match(/\/[^\/]+\?/)) {
                connectionString = connectionString.replace('?', `/${dbName}?`);
            }

            const options = {
                dbName,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 10000,
                retryWrites: false,
                retryReads: true,
            };
            if (connectionString.includes('mongodb.net') || connectionString.includes('azure')) {
                options.tls = true;
                options.tlsAllowInvalidCertificates = false;
                options.authSource = 'admin';
                options.authMechanism = 'SCRAM-SHA-256';
                options.compressors = ['zlib'];
            }

            await mongoose.connect(connectionString, options);
        }
    });

    afterAll(async () => {
        // Limpieza: borramos los users de test y sus TrustHistory.
        const testUsers = await User.find({ email: /@test\.com$/ }).select('_id');
        const ids = testUsers.map((u) => u._id);
        await TrustHistory.deleteMany({ user_id: { $in: ids } });
        await User.deleteMany({ _id: { $in: ids } });
        await mongoose.connection.close();
    });

    describe('decrementTrust', () => {
        it('decrementa de 4 a 3 y escribe TrustHistory', async () => {
            const user = await createUser();
            const result = await trustService.decrementTrust(user._id, {
                reason: 'cancel_gifted_trip_passenger',
                actorId: user._id,
            });

            expect(result.changed).toBe(true);
            expect(result.previousScore).toBe(4);
            expect(result.newScore).toBe(3);
            expect(result.user.isActive).toBe(true);

            const history = await TrustHistory.findOne({ user_id: user._id });
            expect(history).not.toBeNull();
            expect(history.delta).toBe(-1);
            expect(history.reason).toBe('cancel_gifted_trip_passenger');
        });

        it('llega a 0 y marca isActive=false', async () => {
            const user = await createUser({ trustScore: 1 });
            const result = await trustService.decrementTrust(user._id, {
                reason: 'cancel_in_progress_ride_driver',
                actorId: user._id,
            });

            expect(result.changed).toBe(true);
            expect(result.newScore).toBe(0);
            expect(result.user.isActive).toBe(false);
        });

        it('no decrementa por debajo de 0 (no-op idempotente)', async () => {
            const user = await createUser({ trustScore: 0, isActive: false });
            const result = await trustService.decrementTrust(user._id, {
                reason: 'cancel_gifted_trip_passenger',
                actorId: user._id,
            });

            expect(result.changed).toBe(false);
            expect(result.newScore).toBe(0);

            // No debe haber escrito una nueva entrada de history.
            const count = await TrustHistory.countDocuments({ user_id: user._id });
            expect(count).toBe(0);
        });

        it('admin es inmune al decremento', async () => {
            const admin = await createUser({ type: 'admin', phone: undefined, company: undefined });
            const result = await trustService.decrementTrust(admin._id, {
                reason: 'cancel_in_progress_ride_driver',
                actorId: admin._id,
            });

            expect(result.changed).toBe(false);
            expect(result.newScore).toBe(4);

            const count = await TrustHistory.countDocuments({ user_id: admin._id });
            expect(count).toBe(0);
        });
    });

    describe('incrementTrust', () => {
        it('incrementa de 2 a 3 y reactiva si estaba inactivo', async () => {
            const user = await createUser({ trustScore: 0, isActive: false });
            const admin = await createUser({ type: 'admin', phone: undefined, company: undefined });

            const result = await trustService.incrementTrust(user._id, {
                actorId: admin._id,
            });

            expect(result.changed).toBe(true);
            expect(result.previousScore).toBe(0);
            expect(result.newScore).toBe(1);
            expect(result.user.isActive).toBe(true);

            const history = await TrustHistory.findOne({
                user_id: user._id,
                reason: 'admin_increment',
            });
            expect(history).not.toBeNull();
            expect(history.delta).toBe(1);
        });

        it('no incrementa por encima de 4 (cap)', async () => {
            const user = await createUser({ trustScore: 4 });
            const admin = await createUser({ type: 'admin', phone: undefined, company: undefined });

            const result = await trustService.incrementTrust(user._id, {
                actorId: admin._id,
            });

            expect(result.changed).toBe(false);
            expect(result.newScore).toBe(4);
        });
    });

    describe('resetTrust', () => {
        it('lleva a 4 e isActive=true desde 0', async () => {
            const user = await createUser({ trustScore: 0, isActive: false });
            const admin = await createUser({ type: 'admin', phone: undefined, company: undefined });

            const result = await trustService.resetTrust(user._id, { actorId: admin._id });

            expect(result.changed).toBe(true);
            expect(result.newScore).toBe(4);
            expect(result.user.isActive).toBe(true);

            const history = await TrustHistory.findOne({
                user_id: user._id,
                reason: 'admin_reset',
            });
            expect(history).not.toBeNull();
        });

        it('idempotente: no escribe history si ya estaba en 4 y activo', async () => {
            const user = await createUser({ trustScore: 4, isActive: true });
            const admin = await createUser({ type: 'admin', phone: undefined, company: undefined });

            const result = await trustService.resetTrust(user._id, { actorId: admin._id });

            expect(result.changed).toBe(false);
            const count = await TrustHistory.countDocuments({
                user_id: user._id,
                reason: 'admin_reset',
            });
            expect(count).toBe(0);
        });
    });
});
