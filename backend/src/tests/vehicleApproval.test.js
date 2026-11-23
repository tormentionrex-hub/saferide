const { Document, Vehicle } = require('../models');
const vehicleApprovalService = require('../services/vehicleApprovalService');

jest.mock('../models', () => ({
  Document: { find: jest.fn() },
  Vehicle: { find: jest.fn(), distinct: jest.fn() },
}));

const baseDate = new Date('2026-01-01T00:00:00.000Z');

const approvedDocs = () => vehicleApprovalService.DOCUMENT_TYPES.map((type) => ({
  _id: `doc-${type}`,
  type,
  status: 'approved',
  createdAt: baseDate,
}));

const mockDocuments = (documents) => {
  Document.find.mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(documents),
  });
};

const mockVehicles = (vehicles) => {
  Vehicle.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue(vehicles),
  });
};

const makeVehicle = (id, isActive) => ({
  _id: id,
  isActive,
  save: jest.fn().mockResolvedValue(undefined),
});

describe('vehicleApprovalService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aprueba al conductor solo cuando los 6 documentos están aprobados', async () => {
    mockDocuments(approvedDocs());

    const result = await vehicleApprovalService.getDocumentApproval('driver-1');

    expect(result.approved).toBe(true);
    expect(result.pending).toEqual([]);
    expect(result.details).toHaveLength(6);
  });

  it('marca pendiente si falta la tarjeta de circulación', async () => {
    mockDocuments(approvedDocs().filter((doc) => doc.type !== 'tarjeta_circulacion'));

    const result = await vehicleApprovalService.getDocumentApproval('driver-1');

    expect(result.approved).toBe(false);
    expect(result.pending).toContain('Tarjeta de circulación: Sin subir');
  });

  it('usa el documento más reciente de cada tipo', async () => {
    mockDocuments([
      ...approvedDocs(),
      {
        _id: 'doc-rtv-new',
        type: 'rtv',
        status: 'rejected',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);

    const result = await vehicleApprovalService.getDocumentApproval('driver-1');

    expect(result.approved).toBe(false);
    expect(result.pending).toContain('RTV (Dekra): Rechazado');
  });

  it('activa solo el vehículo preferido y desactiva los demás', async () => {
    mockDocuments(approvedDocs());
    const oldVehicle = makeVehicle('vehicle-old', true);
    const newVehicle = makeVehicle('vehicle-new', false);
    mockVehicles([newVehicle, oldVehicle]);

    const result = await vehicleApprovalService.syncVehicleApproval('driver-1', 'vehicle-new');

    expect(result.activated).toBe(true);
    expect(result.changed).toBe(2);
    expect(newVehicle.isActive).toBe(true);
    expect(oldVehicle.isActive).toBe(false);
  });

  it('desactiva el vehículo cuando un documento deja de estar aprobado', async () => {
    mockDocuments(approvedDocs().filter((doc) => doc.type !== 'marchamo'));
    const vehicle = makeVehicle('vehicle-1', true);
    mockVehicles([vehicle]);

    const result = await vehicleApprovalService.syncVehicleApproval('driver-1');

    expect(result.activated).toBe(false);
    expect(vehicle.isActive).toBe(false);
    expect(vehicle.save).toHaveBeenCalled();
  });
});
