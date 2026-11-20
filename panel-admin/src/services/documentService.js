
import api from './api';

/**
 * documentService — Cliente HTTP para el flujo de verificación de documentos.
 *
 * Modo simulado: SOLO si VITE_DOCUMENTS_MOCK=true (explícito, para demos o
 * desarrollo sin backend de documentos). Antes, por defecto ("auto"), un 404
 * del backend hacía aparecer documentos inventados que el admin podía
 * "aprobar" como si fueran reales. Ahora:
 *   - sin la variable: siempre se usa el backend y sus errores se propagan.
 *   - con la variable: nunca se toca el backend, los documentos llevan
 *     isMock: true, el panel muestra un aviso y aprobar/rechazar/reprocesar
 *     están bloqueados (aquí y en la UI).
 */

const DOC_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'];
const REQUIRED_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv'];

const DOC_TYPE_LABELS = {
  cedula: 'Cédula de identidad',
  licencia: 'Licencia de conducir',
  poliza: 'Póliza de seguro',
  marchamo: 'Marchamo',
  rtv: 'RTV (Dekra)',
  tarjeta_circulacion: 'Tarjeta de circulación',
};

const STATUS_LABELS = {
  pending: 'En cola',
  processing: 'Verificando',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  needs_review: 'Revisión manual',
};

export const isDocumentsMock =
  String(import.meta.env?.VITE_DOCUMENTS_MOCK || '').trim().toLowerCase() === 'true';

export const MOCK_ACTION_ERROR =
  'Documentos simulados (modo demo): no se pueden aprobar, rechazar ni reprocesar.';

const isMockDocId = (documentId) => String(documentId ?? '').startsWith('mock-');

// ───────────────────────────────────────────────────────────
// Mock store (en memoria) — sobrevive sólo a la sesión actual
// ───────────────────────────────────────────────────────────
const _mockStore = new Map(); // driverId -> Array<DriverDocument>

const buildMockDocuments = (driverId) => {
  const now = Date.now();
  const day = 86400000;
  const seedRand = driverId
    ? driverId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    : 0;

  const variations = [
    {
      type: 'cedula',
      status: 'approved',
      extracted: { fullName: 'JUAN PEREZ MORA', documentNumber: '113450789', expiryDate: new Date(now + 365 * day).toISOString() },
      matches: [
        { rule: 'nombre_coincide', passed: true, reason: 'OCR: JUAN PEREZ MORA vs sistema' },
        { rule: 'numero_valido', passed: true, reason: 'Formato 9 dígitos correcto' },
      ],
    },
    {
      type: 'licencia',
      status: 'approved',
      extracted: { fullName: 'JUAN PEREZ MORA', documentNumber: '113450789', licenseNumber: 'B1-2023-001', licenseClass: 'B1', expiryDate: new Date(now + 180 * day).toISOString() },
      matches: [
        { rule: 'nombre_coincide', passed: true },
        { rule: 'cedula_coincide', passed: true },
        { rule: 'vigente', passed: true },
      ],
    },
    {
      type: 'poliza',
      status: 'needs_review',
      extracted: { policyHolder: 'JUAN PERES MORA', licensePlate: 'BLZ123', policyNumber: 'POL-99283-X', insurer: 'INS', expiryDate: new Date(now + 90 * day).toISOString() },
      matches: [
        { rule: 'titular_coincide', passed: false, reason: 'Similitud 0.78 (umbral 0.85) — posible error tipográfico' },
        { rule: 'placa_coincide', passed: true },
        { rule: 'vigente', passed: true },
      ],
    },
    {
      type: 'marchamo',
      status: 'pending',
      extracted: null,
      matches: [],
    },
    {
      type: 'rtv',
      status: 'rejected',
      extracted: { licensePlate: 'BLZ123', vehicleBrand: 'Toyota', vehicleModel: 'Corolla', expiryDate: new Date(now - 30 * day).toISOString() },
      matches: [
        { rule: 'placa_coincide', passed: true },
        { rule: 'vigente', passed: false, reason: 'Venció hace 30 días' },
      ],
      rejectionReason: 'RTV vencida hace 30 días',
    },
  ];

  // Pequeña variación entre conductores para que cada perfil se vea distinto.
  const offset = seedRand % variations.length;
  return variations.map((v, i) => ({
    _id: `mock-${driverId}-${v.type}`,
    isMock: true,
    driver_id: driverId,
    type: v.type,
    fileUrl: `https://via.placeholder.com/600x380.png?text=${encodeURIComponent(DOC_TYPE_LABELS[v.type])}`,
    mimeType: 'image/png',
    status: (i + offset) % 7 === 0 ? 'processing' : v.status,
    ocrText: v.extracted
      ? `--- OCR simulado ---\nNombre: ${v.extracted.fullName || v.extracted.policyHolder || ''}\nNúmero: ${v.extracted.documentNumber || v.extracted.policyNumber || ''}\nPlaca: ${v.extracted.licensePlate || ''}\nVence: ${v.extracted.expiryDate || ''}`
      : null,
    extractedData: v.extracted,
    validation: { matches: v.matches, confidence: 0.78 + (i * 0.04) },
    rejectionReason: v.rejectionReason,
    createdAt: new Date(now - i * day).toISOString(),
    updatedAt: new Date(now - i * day).toISOString(),
  }));
};

const ensureMock = (driverId) => {
  if (!_mockStore.has(driverId)) {
    _mockStore.set(driverId, buildMockDocuments(driverId));
  }
  return _mockStore.get(driverId);
};

// ───────────────────────────────────────────────────────────
// API real (con fallback a mock)
// ───────────────────────────────────────────────────────────

export const getDocumentsByDriver = async (driverId) => {
  if (isDocumentsMock) return ensureMock(driverId);
  const res = await api.get(`/documents/driver/${driverId}`);
  return res.data?.data || [];
};

export const getPendingDocuments = async ({ page = 1, limit = 20 } = {}) => {
  if (isDocumentsMock) {
    const all = [..._mockStore.values()].flat()
      .filter(d => ['pending', 'processing', 'needs_review'].includes(d.status));
    return { data: all.slice((page - 1) * limit, page * limit), pagination: { total: all.length, page, pages: Math.ceil(all.length / limit) } };
  }
  const res = await api.get('/documents/admin/pending', { params: { page, limit } });
  return { data: res.data?.data || [], pagination: res.data?.pagination };
};

export const reviewDocument = async (documentId, { action, reason } = {}) => {
  if (isDocumentsMock || isMockDocId(documentId)) throw new Error(MOCK_ACTION_ERROR);
  const res = await api.patch(`/documents/${documentId}/review`, { action, reason });
  return res.data?.data;
};

export const reprocessDocument = async (documentId) => {
  if (isDocumentsMock || isMockDocId(documentId)) throw new Error(MOCK_ACTION_ERROR);
  const res = await api.post(`/documents/${documentId}/reprocess`);
  return res.data?.data;
};

export const getMockState = () => _mockStore;

export default {
  isDocumentsMock,
  getDocumentsByDriver,
  getPendingDocuments,
  reviewDocument,
  reprocessDocument,
  DOC_TYPES,
  REQUIRED_TYPES,
  DOC_TYPE_LABELS,
  STATUS_LABELS,
};
