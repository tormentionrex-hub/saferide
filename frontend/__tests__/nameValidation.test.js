import { validatePersonName } from '../src/utils/nameValidation';

describe('validatePersonName', () => {
    test.each(["María José Núñez", "Seán O'Neil", 'D’Angelo Müller', 'Jean-Luc Picard', 'Ana M. Vega', 'Zoë Ñandú', '(QA) Pasajero Arquitecto'])('acepta %p', (n) => {
        expect(validatePersonName(n)).toBeNull();
    });
    test.each([
        ['', /requerido/], ['   ', /requerido/], ['Ana', /al menos/], ['A'.repeat(101), /superar/],
        ['<script>x</script>', /solo puede/], ['Ana <b>', /solo puede/], ['Ana\u0007Vega', /solo puede/],
        ['😀 Ana Vega', /solo puede/], ['Ana123', /solo puede/], ['(((-)))', /solo puede/],
    ])('rechaza %p', (n, re) => {
        expect(validatePersonName(n)).toMatch(re);
    });
});
