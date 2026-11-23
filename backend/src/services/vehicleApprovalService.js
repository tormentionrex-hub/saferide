const { Document, Vehicle } = require('../models');

const DOCUMENT_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'];

const DOCUMENT_LABELS = {
  cedula: 'Cédula de identidad',
  licencia: 'Licencia de conducir',
  poliza: 'Póliza de seguro',
  marchamo: 'Marchamo',
  rtv: 'RTV (Dekra)',
  tarjeta_circulacion: 'Tarjeta de circulación',
};

const STATUS_LABELS = {
  missing: 'Sin subir',
  pending: 'En cola',
  processing: 'Verificando',
  needs_review: 'Revisión manual',
  rejected: 'Rechazado',
  approved: 'Aprobado',
};

const getDocumentApproval = async (driverId) => {
  const documents = await Document.find({
    driver_id: driverId,
    type: { $in: DOCUMENT_TYPES },
  }).sort({ createdAt: -1, _id: -1 }).lean();

  const latestByType = new Map();
  for (const document of documents) {
    const current = latestByType.get(document.type);
    if (!current || new Date(document.createdAt) >= new Date(current.createdAt)) {
      latestByType.set(document.type, document);
    }
  }

  const details = DOCUMENT_TYPES.map((type) => {
    const document = latestByType.get(type);
    const status = document?.status || 'missing';
    return {
      type,
      label: DOCUMENT_LABELS[type],
      status,
      statusLabel: STATUS_LABELS[status] || status,
      approved: status === 'approved',
      documentId: document?._id || null,
    };
  });

  const pending = details
    .filter((detail) => !detail.approved)
    .map((detail) => `${detail.label}: ${detail.statusLabel}`);

  return {
    approved: pending.length === 0,
    details,
    pending,
  };
};

const syncVehicleApproval = async (driverId, preferredVehicleId) => {
  const approval = await getDocumentApproval(driverId);
  const vehicles = await Vehicle.find({ driver_id: driverId }).sort({ createdAt: -1, _id: -1 });

  if (vehicles.length === 0) {
    return { ...approval, changed: 0, vehicle: null, activated: false };
  }

  const preferred = preferredVehicleId
    ? vehicles.find((vehicle) => String(vehicle._id) === String(preferredVehicleId))
    : null;
  const candidate = preferred || vehicles.find((vehicle) => vehicle.isActive) || vehicles[0];

  let changed = 0;
  for (const vehicle of vehicles) {
    const shouldBeActive = approval.approved && String(vehicle._id) === String(candidate._id);
    if (vehicle.isActive === shouldBeActive) continue;
    vehicle.isActive = shouldBeActive;
    await vehicle.save();
    changed += 1;
  }

  return {
    ...approval,
    changed,
    vehicle: approval.approved ? candidate : null,
    activated: approval.approved,
  };
};

const syncAllVehicleApprovals = async () => {
  const driverIds = await Vehicle.distinct('driver_id');
  const results = [];

  for (const driverId of driverIds) {
    results.push(await syncVehicleApproval(driverId));
  }

  return {
    drivers: results.length,
    changed: results.reduce((total, result) => total + result.changed, 0),
    activated: results.filter((result) => result.activated).length,
  };
};

const getPendingDriversCount = async () => {
  const driverIds = await Vehicle.distinct('driver_id');
  let pending = 0;

  for (const driverId of driverIds) {
    const approval = await getDocumentApproval(driverId);
    if (!approval.approved) pending += 1;
  }

  return pending;
};

module.exports = {
  DOCUMENT_TYPES,
  getDocumentApproval,
  getPendingDriversCount,
  syncVehicleApproval,
  syncAllVehicleApprovals,
};
