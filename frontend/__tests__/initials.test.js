import { getInitials } from '../src/utils/initials';

describe('getInitials', () => {
    test.each([
        ['(QA) Conductor Arquitecto', 2, 'QC'],
        ['Pasajero 1 Vega', 2, 'PV'],
        ['  María   José ', 2, 'MJ'],
        ['<img src=x>', 2, 'IS'],
        ['😀 Ana', 1, 'A'],
        ['123 !!!', 2, '?'],
        ['', 2, '?'],
        [null, 1, '?'],
        ['ñandú élite', 2, 'ÑÉ'],
    ])('%p (max %p) → %p', (name, max, expected) => {
        expect(getInitials(name, max)).toBe(expected);
    });
});
