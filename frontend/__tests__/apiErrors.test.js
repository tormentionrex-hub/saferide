import { classifyApiError, describeLoginError, isSessionRejected, NETWORK_MESSAGE, SERVER_MESSAGE } from '../src/utils/apiErrors';

const res = (status, data = {}) => ({ response: { status, data } });

describe('apiErrors', () => {
    test.each([
        [{ message: 'Network Error' }, 'network'],
        [{ code: 'ECONNABORTED' }, 'network'],
        [res(500), 'server'], [res(503), 'server'],
        [res(401), 'auth'], [res(403), 'auth'],
        [res(429), 'rate'], [res(400), 'client'],
    ])('%p → %s', (err, kind) => expect(classifyApiError(err)).toBe(kind));

    test('mensajes de inicio de sesión', () => {
        expect(describeLoginError({ message: 'Network Error' })).toBe(NETWORK_MESSAGE);
        expect(describeLoginError(res(502))).toBe(SERVER_MESSAGE);
        expect(describeLoginError(res(401, { message: 'Invalid credentials' }))).toBe('Correo o contraseña incorrectos.');
        expect(describeLoginError(res(403, { code: 'ACCOUNT_INACTIVE' }))).toMatch(/desactivada/);
        expect(describeLoginError(res(400, { errors: [{ message: 'Email inválido' }] }))).toBe('Email inválido');
    });

    test('solo un rechazo del backend cierra la sesión', () => {
        expect(isSessionRejected({ message: 'Network Error' })).toBe(false);
        expect(isSessionRejected(res(500))).toBe(false);
        expect(isSessionRejected(res(401))).toBe(true);
    });
});
