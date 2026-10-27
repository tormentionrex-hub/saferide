import { formatNumber, formatExpiry, detectBrand, onlyDigits } from '../src/utils/cardFormat';

describe('formato de tarjeta del checkout', () => {
    test('agrupa el número de cuatro en cuatro e ignora lo que no es dígito', () => {
        expect(formatNumber('4111111111111111')).toBe('4111 1111 1111 1111');
        expect(formatNumber('4111-1111 11ab11')).toBe('4111 1111 1111');
    });

    test('corta el número en 19 dígitos', () => {
        expect(onlyDigits(formatNumber('1'.repeat(25)))).toHaveLength(19);
    });

    test('pone la barra de la fecha de caducidad', () => {
        expect(formatExpiry('1')).toBe('1');
        expect(formatExpiry('12')).toBe('12');
        expect(formatExpiry('123')).toBe('12/3');
        expect(formatExpiry('12/30')).toBe('12/30');
        expect(formatExpiry('123099')).toBe('12/30');
    });

    test('detecta la marca por los primeros dígitos', () => {
        expect(detectBrand('4111')).toBe('visa');
        expect(detectBrand('5555 5555')).toBe('mastercard');
        expect(detectBrand('2221')).toBe('mastercard');
        expect(detectBrand('3714')).toBe('amex');
        expect(detectBrand('6011')).toBeNull();
        expect(detectBrand('')).toBeNull();
    });
});
