// resolveApiUrl decide a qué backend habla la app.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: '192.168.0.25:8081' } } }));

const load = () => {
    let mod;
    jest.isolateModules(() => { mod = require('../src/config'); });
    return mod;
};

describe('URL del backend', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    afterEach(() => { process.env.EXPO_PUBLIC_API_URL = original; });

    test('usa EXPO_PUBLIC_API_URL sin la barra final', () => {
        process.env.EXPO_PUBLIC_API_URL = 'https://api.saferide.cr/api/v1/';
        expect(load().resolveApiUrl()).toBe('https://api.saferide.cr/api/v1');
    });

    test('sin variable, usa la IP de la PC que sirve Expo', () => {
        delete process.env.EXPO_PUBLIC_API_URL;
        expect(load().resolveApiUrl()).toBe('http://192.168.0.25:8080/api/v1');
    });
});
