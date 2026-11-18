
import api from './api';

/**
 * documentService — Cliente HTTP para el flujo de verificación de documentos.
 *
 * Mientras el backend no exponga /api/v1/documents/*, este servicio cae a una
 * fuente mock para que la UI siga funcionando. La activación del mock se
 * controla con la flag VITE_DOCUMENTS_MOCK ("auto" | "always" | "never").
 *   - auto (default): mock sólo cuando la respuesta sea 404 o connection error
 *   - always: nunca toca el backend
 *   - never: propaga el error sin mockear
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

const MOCK_MODE = (import.meta.env?.VITE_DOCUMENTS_MOCK || 'auto').toLowerCase();

const isMissingEndpoint = (err) =>
  err?.response?.status === 404 || err?.code === 'ERR_NETWORK';

const useMock = (err) =>
  MOCK_MODE === 'always' || (MOCK_MODE === 'auto' && isMissingEndpoint(err));

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
  if (MOCK_MODE === 'always') return ensureMock(driverId);
  try {
    const res = await api.get(`/documents/driver/${driverId}`);
    return res.data?.data || [];
  } catch (err) {
    if (useMock(err)) {
      console.warn('[documentService] usando mock — endpoint no disponible');
      return ensureMock(driverId);
    }
    throw err;
  }
};

export const getPendingDocuments = async ({ page = 1, limit = 20 } = {}) => {
  if (MOCK_MODE === 'always') {
    const all = [..._mockStore.values()].flat()
      .filter(d => ['pending', 'processing', 'needs_review'].includes(d.status));
    return { data: all.slice((page - 1) * limit, page * limit), pagination: { total: all.length, page, pages: Math.ceil(all.length / limit) } };
  }
  try {
    const res = await api.get('/documents/admin/pending', { params: { page, limit } });
    return { data: res.data?.data || [], pagination: res.data?.pagination };
  } catch (err) {
    if (useMock(err)) {
      const all = [..._mockStore.values()].flat()
        .filter(d => ['pending', 'processing', 'needs_review'].includes(d.status));
      return { data: all, pagination: { total: all.length, page: 1, pages: 1 } };
    }
    throw err;
  }
};

export const reviewDocument = async (documentId, { action, reason } = {}) => {
  if (MOCK_MODE === 'always' || documentId?.toString().startsWith('mock-')) {
    return _mockReview(documentId, action, reason);
  }
  try {
    const res = await api.patch(`/documents/${documentId}/review`, { action, reason });
    return res.data?.data;
  } catch (err) {
    if (useMock(err)) return _mockReview(documentId, action, reason);
    throw err;
  }
};

export const reprocessDocument = async (documentId) => {
  if (MOCK_MODE === 'always' || documentId?.toString().startsWith('mock-')) {
    return _mockReprocess(documentId);
  }
  try {
    const res = await api.post(`/documents/${documentId}/reprocess`);
    return res.data?.data;
  } catch (err) {
    if (useMock(err)) return _mockReprocess(documentId);
    throw err;
  }
};

// ───────────────────────────────────────────────────────────
// Helpers mock (mutación en memoria)
// ───────────────────────────────────────────────────────────
const _findMockDoc = (documentId) => {
  for (const docs of _mockStore.values()) {
    const found = docs.find(d => d._id === documentId);
    if (found) return found;
  }
  return null;
};

const _mockReview = (documentId, action, reason) => {
  const doc = _findMockDoc(documentId);
  if (!doc) throw new Error('Documento mock no encontrado');
  if (action === 'approve') doc.status = 'approved';
  else if (action === 'reject') { doc.status = 'rejected'; doc.rejectionReason = reason || 'Rechazado'; }
  else if (action === 'request_resend') { doc.status = 'rejected'; doc.rejectionReason = reason || 'Reenvío solicitado'; }
  doc.reviewedAt = new Date().toISOString();
  doc.updatedAt = doc.reviewedAt;
  return doc;
};

const _mockReprocess = (documentId) => {
  const doc = _findMockDoc(documentId);
  if (!doc) throw new Error('Documento mock no encontrado');
  doc.status = 'processing';
  doc.updatedAt = new Date().toISOString();
  setTimeout(() => {
    doc.status = 'needs_review';
    doc.updatedAt = new Date().toISOString();
  }, 4000);
  return doc;
};

export const getMockState = () => _mockStore;

export default {
  getDocumentsByDriver,
  getPendingDocuments,
  reviewDocument,
  reprocessDocument,
  DOC_TYPES,
  REQUIRED_TYPES,
  DOC_TYPE_LABELS,
  STATUS_LABELS,
};
