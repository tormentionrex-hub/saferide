import { withListLimit, LIST_LIMIT } from '../src/services/listLimit';

const get = (url, params) => withListLimit({ method: 'get', url, params });

describe('límite de listados del interceptor', () => {
    test('agrega limit a los listados de viajes y reservas', () => {
        expect(get('/rides').params).toEqual({ limit: LIST_LIMIT });
        expect(get('/bookings').params).toEqual({ limit: LIST_LIMIT });
        expect(get('/rides/driver/abc', { status: 'completed' }).params)
            .toEqual({ status: 'completed', limit: LIST_LIMIT });
        expect(get('/bookings/passenger/123').params).toEqual({ limit: LIST_LIMIT });
    });

    test('respeta el limit que ya trae la pantalla', () => {
        expect(get('/bookings?status=pending&limit=5').params).toBeUndefined();
        expect(get('/rides', { limit: 20 }).params).toEqual({ limit: 20 });
    });

    test('no toca detalles, acciones ni otros endpoints', () => {
        expect(get('/rides/abc').params).toBeUndefined();
        expect(get('/bookings/ride/abc').params).toBeUndefined();
        expect(get('/notifications').params).toBeUndefined();
        expect(withListLimit({ method: 'post', url: '/bookings' }).params).toBeUndefined();
    });
});
