import api from './api';

const DOC_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'];
const REQUIRED_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'];

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

export const DOC_GROUP_META = {
  reviewed: { label: 'Revisado', color: '#10B981', bg: '#D1FAE5' },
  partial:  { label: 'Parcial',  color: '#F59E0B', bg: '#FEF3C7' },
  unseen:   { label: 'Sin ver',  color: '#EF4444', bg: '#FEE2E2' },
  missing:  { label: 'Sin subir', color: '#94A3B8', bg: '#F8FAFC' },
};

export const getLatestDocumentsByType = (documents = []) =>
  documents.reduce((latest, doc) => {
    const current = latest[doc.type];
    if (!current || new Date(doc.createdAt || 0) >= new Date(current.createdAt || 0)) {
      latest[doc.type] = doc;
    }
    return latest;
  }, {});

export const getDocGroup = (doc) => {
  if (!doc) return 'missing';
  if (doc.status === 'approved') return 'reviewed';
  if (doc.status === 'pending' && !doc.reviewedAt && !doc.reviewedBy) return 'unseen';
  return 'partial';
};

export const getDriverDocFlag = (documents = []) => {
  const latest = getLatestDocumentsByType(documents);
  const priority = { reviewed: 1, missing: 2, partial: 3, unseen: 4 };
  const worst = REQUIRED_TYPES.reduce(
    (acc, type) => Math.max(acc, priority[getDocGroup(latest[type])] ?? 2),
    1,
  );
  if (worst === 4) return 'unseen';
  if (worst === 3) return 'partial';
  if (worst === 2) return 'missing';
  return 'reviewed';
};

export const getDocumentsByDriver = async (driverId) => {
  const res = await api.get(`/documents/driver/${driverId}`);
  return res.data?.data || [];
};

export const getPendingDocuments = async ({ page = 1, limit = 20 } = {}) => {
  const res = await api.get('/documents/admin/pending', { params: { page, limit } });
  return { data: res.data?.data || [], stats: res.data?.stats, pagination: res.data?.pagination };
};

export const reviewDocument = async (documentId, { action, reason } = {}) => {
  const res = await api.patch(`/documents/${documentId}/review`, { action, reason });
  return res.data?.data;
};

export const reprocessDocument = async (documentId) => {
  const res = await api.post(`/documents/${documentId}/reprocess`);
  return res.data?.data;
};

export default {
  getDocumentsByDriver,
  getPendingDocuments,
  reviewDocument,
  reprocessDocument,
  getDocGroup,
  getLatestDocumentsByType,
  getDriverDocFlag,
  DOC_GROUP_META,
  DOC_TYPES,
  REQUIRED_TYPES,
  DOC_TYPE_LABELS,
  STATUS_LABELS,
};
