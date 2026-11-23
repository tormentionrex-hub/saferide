import { DOCUMENT_FORMS, buildInitialValues, validateDocumentForm, countApproved } from '../src/utils/driverDocuments';

const future = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const vehicle = { license_plate: 'ABC123', brand: 'Toyota', model: 'Corolla', year: 2021 };

describe('driverDocuments', () => {
    test('hay formulario para los 6 documentos que exige el panel', () => {
        expect(Object.keys(DOCUMENT_FORMS).sort()).toEqual(['cedula', 'licencia', 'marchamo', 'poliza', 'rtv', 'tarjeta_circulacion']);
    });

    test('precarga los datos de la cuenta y del vehículo', () => {
        const v = buildInitialValues('marchamo', { driverName: 'Ana Mora', vehicle });
        expect(v).toMatchObject({ licensePlate: 'ABC123', vehicleBrand: 'Toyota', vehicleModel: 'Corolla', vehicleYear: '2021' });
        expect(v.marchamoYear).toBe(String(new Date().getFullYear()));
        expect(buildInitialValues('poliza', { driverName: 'Ana Mora', vehicle }).policyHolder).toBe('Ana Mora');
    });

    test('la licencia toma la cédula ya enviada y lo enviado antes manda sobre lo precargado', () => {
        expect(buildInitialValues('licencia', { cedulaNumber: '1-1111-1111' }).documentNumber).toBe('1-1111-1111');
        expect(buildInitialValues('cedula', { driverName: 'Ana', previous: { fullName: 'Ana María Mora' } }).fullName).toBe('Ana María Mora');
    });

    test('exige foto y todos los campos', () => {
        const ok = { documentNumber: '1-2345-6789', fullName: 'Ana Mora', expiryDate: future };
        expect(validateDocumentForm('cedula', ok, false)).toMatch(/foto/);
        expect(validateDocumentForm('cedula', { ...ok, fullName: '  ' }, true)).toMatch(/nombre/);
        expect(validateDocumentForm('cedula', ok, true)).toBeNull();
    });

    test('rechaza documentos vencidos, placas inválidas, años mal escritos y HTML', () => {
        const base = buildInitialValues('marchamo', { vehicle });
        expect(validateDocumentForm('marchamo', { ...base, expiryDate: past }, true)).toMatch(/vencido/);
        expect(validateDocumentForm('marchamo', { ...base, expiryDate: future, licensePlate: 'ABCDEF' }, true)).toMatch(/placa/i);
        expect(validateDocumentForm('marchamo', { ...base, expiryDate: future, vehicleYear: '21' }, true)).toMatch(/4 dígitos/);
        expect(validateDocumentForm('marchamo', { ...base, expiryDate: future, vehicleBrand: '<b>x</b>' }, true)).toMatch(/no permitidos/);
        expect(validateDocumentForm('marchamo', { ...base, expiryDate: future }, true)).toBeNull();
    });

    test('cuenta los aprobados', () => {
        expect(countApproved([{ approved: true }, { approved: false }, { approved: true }])).toBe(2);
        expect(countApproved()).toBe(0);
    });
});
