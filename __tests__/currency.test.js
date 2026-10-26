import { formatCRC } from '../src/utils/currency';

describe('formatCRC', () => {
    it('separa miles con coma y antepone el símbolo de colón', () => {
        expect(formatCRC(5022)).toBe('₡5,022');
        expect(formatCRC(1250000)).toBe('₡1,250,000');
        expect(formatCRC(950)).toBe('₡950');
    });

    it('acepta strings y redondea decimales', () => {
        expect(formatCRC('2003')).toBe('₡2,003');
        expect(formatCRC(1999.6)).toBe('₡2,000');
    });

    it('muestra ₡0 para valores vacíos o inválidos', () => {
        expect(formatCRC(undefined)).toBe('₡0');
        expect(formatCRC(null)).toBe('₡0');
        expect(formatCRC('abc')).toBe('₡0');
    });

    it('conserva el signo de los montos negativos', () => {
        expect(formatCRC(-1500)).toBe('-₡1,500');
    });
});
