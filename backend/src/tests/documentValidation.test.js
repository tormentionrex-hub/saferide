const { evaluateDocument } = require('../services/documentValidationService');

const futureDate = () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const driver = { name: 'Juan Pérez' };
const vehicle = {
    license_plate: 'ABC123',
    brand: 'Toyota',
    model: 'Corolla',
    year: 2020,
};

describe('documentValidationService.evaluateDocument', () => {
    it('aprueba un documento cuando los datos coinciden con la base de datos', () => {
        const document = {
            type: 'poliza',
            extractedData: {
                policyHolder: 'Juan Perez',
                licensePlate: 'ABC123',
                policyNumber: 'POL-1',
                insurer: 'INS Seguros',
                expiryDate: futureDate(),
            },
        };

        const result = evaluateDocument(document, { driver, vehicle });

        expect(result.status).toBe('approved');
        expect(result.rejectionReason).toBe('');
        expect(result.validation.source).toBe('rules-engine-v1');
        expect(result.validation.summary.failed).toBe(0);
        expect(result.validation.confidence).toBe(1);
    });

    it('rechaza un documento cuando la placa no coincide con el vehículo activo', () => {
        const document = {
            type: 'rtv',
            extractedData: {
                rtvNumber: 'RTV-1',
                licensePlate: 'XYZ999',
                vehicleBrand: 'Toyota',
                vehicleModel: 'Corolla',
                expiryDate: futureDate(),
            },
        };

        const result = evaluateDocument(document, { driver, vehicle });

        expect(result.status).toBe('rejected');
        expect(result.rejectionReason).toContain('Placa no coincide');
        expect(result.validation.summary.failed).toBe(1);
    });

    it('deja en revisión un documento cuando falta el vehículo activo para comparar', () => {
        const document = {
            type: 'marchamo',
            extractedData: {
                licensePlate: 'ABC123',
                vehicleBrand: 'Toyota',
                vehicleModel: 'Corolla',
                vehicleYear: '2020',
                marchamoYear: String(new Date().getFullYear()),
                expiryDate: futureDate(),
            },
        };

        const result = evaluateDocument(document, { driver, vehicle: null });

        expect(result.status).toBe('needs_review');
        expect(result.rejectionReason).toContain('No hay vehículo activo');
        expect(result.validation.summary.missing).toBe(1);
    });

    it('deja en revisión una licencia cuando no hay cédula registrada para comparar', () => {
        const document = {
            type: 'licencia',
            extractedData: {
                fullName: 'Juan Pérez',
                documentNumber: '10123456',
                licenseNumber: 'LIC-1',
                licenseClass: 'B1',
                expiryDate: futureDate(),
            },
        };

        const result = evaluateDocument(document, { driver, vehicle, cedulaDocument: null });

        expect(result.status).toBe('needs_review');
        expect(result.rejectionReason).toContain('No hay número de cédula registrado');
    });
});
