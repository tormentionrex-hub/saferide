import api from './api';

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

export const getDocumentsByDriver = async (driverId) => {
  const res = await api.get(`/documents/driver/${driverId}`);
  return res.data?.data || [];
};

export const getPendingDocuments = async ({ page = 1, limit = 20 } = {}) => {
  const res = await api.get('/documents/admin/pending', { params: { page, limit } });
  return { data: res.data?.data || [], pagination: res.data?.pagination };
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
  DOC_TYPES,
  REQUIRED_TYPES,
  DOC_TYPE_LABELS,
  STATUS_LABELS,
};
