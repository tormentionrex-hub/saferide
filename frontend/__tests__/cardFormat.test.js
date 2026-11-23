import { formatNumber, formatExpiry, detectBrand, onlyDigits, validateCard, luhnValid } from '../src/utils/cardFormat';

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

describe('validación de tarjeta del checkout', () => {
    const now = new Date(2026, 10, 20);
    const ok = { number: '4111 1111 1111 1111', name: "Ana O'Neil-Pérez", expiry: '12/30', cvc: '123' };
    test('acepta una tarjeta válida', () => {
        expect(validateCard(ok, now)).toEqual({});
    });
    test.each([
        ['vacío', { number: '', name: '', expiry: '', cvc: '' }, ['number', 'name', 'expiry', 'cvc']],
        ['Luhn inválido', { ...ok, number: '4111 1111 1111 1112' }, ['number']],
        ['mes 13', { ...ok, expiry: '13/30' }, ['expiry']],
        ['mes 00', { ...ok, expiry: '00/30' }, ['expiry']],
        ['vencida', { ...ok, expiry: '10/26' }, ['expiry']],
        ['HTML en nombre', { ...ok, name: '<script>x</script>' }, ['name']],
        ['solo espacios', { ...ok, name: '     ' }, ['name']],
        ['emoji en nombre', { ...ok, name: '😀 Ana' }, ['name']],
        ['CVC corto', { ...ok, cvc: '12' }, ['cvc']],
        ['Amex pide 4', { ...ok, number: '3782 822463 10005', cvc: '123' }, ['cvc']],
    ])('%s', (_label, card, fields) => {
        expect(Object.keys(validateCard(card, now)).sort()).toEqual([...fields].sort());
    });
    test('el mes en curso todavía no está vencido', () => {
        expect(validateCard({ ...ok, expiry: '11/26' }, now)).toEqual({});
    });
    test('luhnValid rechaza longitudes fuera de rango', () => {
        expect(luhnValid('4'.repeat(11))).toBe(false);
        expect(luhnValid('4'.repeat(20))).toBe(false);
    });
});
