import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, IdCard, Car, ShieldCheck, Receipt, ClipboardCheck,
  CheckCircle2, XCircle, AlertCircle, Clock, RefreshCcw,
  ChevronLeft, ChevronRight, Loader2, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import documentService from '../../services/documentService';
import './DocumentReviewPanel.css';

const TYPE_META = {
  cedula:              { label: 'Cédula',           icon: IdCard,         hint: 'Identidad del conductor' },
  licencia:            { label: 'Licencia',         icon: Car,            hint: 'Habilitación para conducir' },
  poliza:              { label: 'Póliza',           icon: ShieldCheck,    hint: 'Cobertura del vehículo' },
  marchamo:            { label: 'Marchamo',         icon: Receipt,        hint: 'Derecho de circulación' },
  rtv:                 { label: 'RTV (Dekra)',      icon: ClipboardCheck, hint: 'Revisión técnica' },
  tarjeta_circulacion: { label: 'T. circulación',   icon: FileText,       hint: 'Tarjeta de circulación (opcional)' },
};

const STATUS_META = {
  pending:      { label: 'En cola',      color: '#64748B', icon: Clock,        bg: '#F1F5F9' },
  processing:   { label: 'Verificando',  color: '#F59E0B', icon: Loader2,      bg: '#FEF3C7' },
  approved:     { label: 'Aprobado',     color: '#10B981', icon: CheckCircle2, bg: '#D1FAE5' },
  rejected:     { label: 'Rechazado',    color: '#EF4444', icon: XCircle,      bg: '#FEE2E2' },
  needs_review: { label: 'Revisar',      color: '#F59E0B', icon: AlertCircle,  bg: '#FEF3C7' },
};

const NOT_UPLOADED = { label: 'Sin subir', color: '#94A3B8', bg: '#F8FAFC', icon: FileText };

// Mapa de qué campo extraído se compara contra qué campo del sistema.
const COMPARISONS = {
  cedula: [
    { field: 'fullName',       label: 'Nombre',           system: (u) => u?.name },
    { field: 'documentNumber', label: 'Número de cédula', system: () => '—' },
    { field: 'expiryDate',     label: 'Vencimiento',      system: () => 'Debe ser futura', format: 'date' },
  ],
  licencia: [
    { field: 'fullName',       label: 'Nombre',           system: (u) => u?.name },
    { field: 'documentNumber', label: 'Cédula',           system: () => 'Debe coincidir con la cédula' },
    { field: 'licenseNumber',  label: 'N° licencia',      system: () => '—' },
    { field: 'licenseClass',   label: 'Clase',            system: () => '—' },
    { field: 'expiryDate',     label: 'Vencimiento',      system: () => 'Debe ser futura', format: 'date' },
  ],
  poliza: [
    { field: 'policyHolder',   label: 'Titular',          system: (u) => u?.name },
    { field: 'licensePlate',   label: 'Placa',            system: (_u, v) => v?.license_plate },
    { field: 'policyNumber',   label: 'N° póliza',        system: () => '—' },
    { field: 'insurer',        label: 'Aseguradora',      system: () => '—' },
    { field: 'expiryDate',     label: 'Vencimiento',      system: () => 'Debe ser futura', format: 'date' },
  ],
  marchamo: [
    { field: 'licensePlate',   label: 'Placa',            system: (_u, v) => v?.license_plate },
    { field: 'vehicleBrand',   label: 'Marca',            system: (_u, v) => v?.brand },
    { field: 'vehicleModel',   label: 'Modelo',           system: (_u, v) => v?.model },
    { field: 'vehicleYear',    label: 'Año',              system: (_u, v) => v?.year },
    { field: 'marchamoYear',   label: 'Año marchamo',     system: () => new Date().getFullYear() },
    { field: 'expiryDate',     label: 'Vencimiento',      system: () => 'Debe ser futura', format: 'date' },
  ],
  rtv: [
    { field: 'licensePlate',   label: 'Placa',            system: (_u, v) => v?.license_plate },
    { field: 'vehicleBrand',   label: 'Marca',            system: (_u, v) => v?.brand },
    { field: 'vehicleModel',   label: 'Modelo',           system: (_u, v) => v?.model },
    { field: 'rtvNumber',      label: 'N° certificado',   system: () => '—' },
    { field: 'expiryDate',     label: 'Vencimiento',      system: () => 'Debe ser futura', format: 'date' },
  ],
  tarjeta_circulacion: [
    { field: 'fullName',       label: 'Titular',          system: (u) => u?.name },
    { field: 'licensePlate',   label: 'Placa',            system: (_u, v) => v?.license_plate },
    { field: 'vehicleBrand',   label: 'Marca',            system: (_u, v) => v?.brand },
    { field: 'vehicleModel',   label: 'Modelo',           system: (_u, v) => v?.model },
  ],
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-CR'); } catch { return d; }
};

const fmtValue = (val, format) => {
  if (val === null || val === undefined || val === '') return '—';
  if (format === 'date') return fmtDate(val);
  return String(val);
};

// Heurística visual: si el extracted coincide con el system, marcar verde.
// Para fechas: extracted debe ser futura.
const computeMatch = (cmp, extractedValue, systemValue) => {
  if (cmp.format === 'date') {
    if (!extractedValue) return null;
    return new Date(extractedValue) > new Date();
  }
  if (extractedValue === null || extractedValue === undefined || extractedValue === '') return null;
  if (typeof systemValue !== 'string' || !systemValue || systemValue === '—' || systemValue.startsWith('Debe ')) return null;
  return String(extractedValue).toLowerCase().trim() === String(systemValue).toLowerCase().trim()
    || String(extractedValue).toLowerCase().includes(String(systemValue).toLowerCase());
};

const DocumentCard = ({ type, doc, selected, onSelect }) => {
  const meta = TYPE_META[type];
  const status = doc?.status;
  const statusMeta = status ? STATUS_META[status] : NOT_UPLOADED;
  const Icon = meta.icon;
  const StatusIcon = statusMeta.icon;
  return (
    <button
      type="button"
      className={`doc-card ${selected ? 'is-selected' : ''} ${doc ? '' : 'is-empty'}`}
      onClick={() => onSelect(type)}
    >
      <div className="doc-card-icon" style={{ background: statusMeta.bg, color: statusMeta.color }}>
        <Icon size={18} />
      </div>
      <div className="doc-card-body">
        <div className="doc-card-title">{meta.label}</div>
        <div className="doc-card-hint">{meta.hint}</div>
      </div>
      <div className="doc-card-badge" style={{ color: statusMeta.color, borderColor: statusMeta.color, background: statusMeta.bg }}>
        <StatusIcon size={12} className={status === 'processing' ? 'spin' : ''} />
        <span>{statusMeta.label}</span>
      </div>
    </button>
  );
};

const ComparisonRow = ({ cmp, extracted, driver, vehicle }) => {
  const extractedValue = extracted?.[cmp.field];
  const systemValue = cmp.system(driver, vehicle);
  const match = computeMatch(cmp, extractedValue, systemValue);
  return (
    <div className={`cmp-row ${match === true ? 'is-match' : match === false ? 'is-mismatch' : 'is-neutral'}`}>
      <div className="cmp-label">{cmp.label}</div>
      <div className="cmp-value">{fmtValue(extractedValue, cmp.format)}</div>
      <div className="cmp-sep">vs</div>
      <div className="cmp-value system">{fmtValue(systemValue, cmp.format)}</div>
    </div>
  );
};

const DetailView = ({ doc, driver, vehicle, onAction, busy }) => {
  const [showOcr, setShowOcr] = useState(false);
  if (!doc) {
    return (
      <div className="doc-detail empty">
        <FileText size={36} />
        <p>Este documento aún no ha sido subido por el conductor.</p>
      </div>
    );
  }
  const cmps = COMPARISONS[doc.type] || [];
  const statusMeta = STATUS_META[doc.status] || NOT_UPLOADED;

  return (
    <div className="doc-detail">
      <div className="doc-detail-header">
        <div>
          <div className="doc-detail-type">{TYPE_META[doc.type]?.label}</div>
          <div className="doc-detail-meta">
            Subido el {fmtDate(doc.createdAt)} ·{' '}
            <span style={{ color: statusMeta.color, fontWeight: 700 }}>{statusMeta.label}</span>
            {doc.validation?.confidence != null && (
              <> · confianza {(doc.validation.confidence * 100).toFixed(0)}%</>
            )}
          </div>
        </div>
        <a className="doc-detail-open" href={doc.fileUrl} target="_blank" rel="noreferrer">
          <Eye size={14} /> Abrir
        </a>
      </div>

      <div className="doc-detail-preview">
        {doc.mimeType?.startsWith('image/')
          ? <img src={doc.fileUrl} alt={doc.type} />
          : <div className="doc-pdf-fallback">PDF — ábrelo para verlo</div>}
      </div>

      {doc.rejectionReason && (
        <div className="doc-reject-banner">
          <XCircle size={14} /> {doc.rejectionReason}
        </div>
      )}

      <div className="doc-section-title">Datos extraídos vs datos del sistema</div>
      <div className="cmp-header">
        <span>Campo</span>
        <span>OCR / Agente</span>
        <span></span>
        <span>Sistema</span>
      </div>
      <div className="cmp-list">
        {cmps.map(c => (
          <ComparisonRow
            key={c.field}
            cmp={c}
            extracted={doc.extractedData}
            driver={driver}
            vehicle={vehicle}
          />
        ))}
      </div>

      {doc.validation?.matches?.length > 0 && (
        <>
          <div className="doc-section-title">Reglas evaluadas</div>
          <ul className="rule-list">
            {doc.validation.matches.map((m, i) => (
              <li key={i} className={m.passed ? 'rule-ok' : 'rule-fail'}>
                {m.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span className="rule-name">{m.rule}</span>
                {m.reason && <span className="rule-reason">{m.reason}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {doc.ocrText && (
        <>
          <button type="button" className="doc-ocr-toggle" onClick={() => setShowOcr(s => !s)}>
            {showOcr ? 'Ocultar OCR crudo' : 'Ver OCR crudo'}
          </button>
          {showOcr && <pre className="doc-ocr-text">{doc.ocrText}</pre>}
        </>
      )}

      <div className="doc-actions">
        <button
          type="button"
          className="doc-action approve"
          disabled={busy || doc.status === 'approved'}
          onClick={() => onAction('approve')}
        >
          <CheckCircle2 size={14} /> Aprobar
        </button>
        <button
          type="button"
          className="doc-action reject"
          disabled={busy || doc.status === 'rejected'}
          onClick={() => onAction('reject')}
        >
          <XCircle size={14} /> Rechazar
        </button>
        <button
          type="button"
          className="doc-action resend"
          disabled={busy}
          onClick={() => onAction('request_resend')}
        >
          <RefreshCcw size={14} /> Pedir reenvío
        </button>
        <button
          type="button"
          className="doc-action reprocess"
          disabled={busy}
          onClick={() => onAction('reprocess')}
        >
          <RefreshCcw size={14} /> Reprocesar
        </button>
      </div>
    </div>
  );
};

const DocumentReviewPanel = ({ driver, vehicle, filterTypes }) => {
  const driverId = driver?._id;
  const visibleTypes = useMemo(
    () => (Array.isArray(filterTypes) && filterTypes.length > 0
      ? filterTypes.filter(t => TYPE_META[t])
      : Object.keys(TYPE_META)),
    [filterTypes],
  );
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState(visibleTypes[0]);
  const [busy, setBusy] = useState(false);

  // Si el subset visible cambia y el tab activo ya no aplica, saltar al primero.
  useEffect(() => {
    if (!visibleTypes.includes(activeType)) setActiveType(visibleTypes[0]);
  }, [visibleTypes, activeType]);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const list = await documentService.getDocumentsByDriver(driverId);
      setDocs(list);
    } catch (err) {
      console.error('[DocumentReviewPanel] load error:', err);
      toast.error('No se pudieron cargar los documentos');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => { load(); }, [load]);

  const docsByType = useMemo(() => {
    const map = {};
    for (const d of docs) {
      if (!map[d.type] || new Date(d.createdAt) > new Date(map[d.type].createdAt)) {
        map[d.type] = d;
      }
    }
    return map;
  }, [docs]);

  const activeDoc = docsByType[activeType];

  const handleAction = async (action) => {
    if (!activeDoc) {
      toast.error('No hay documento para esta acción');
      return;
    }
    let reason;
    if (action === 'reject' || action === 'request_resend') {
      const { value, isConfirmed } = await Swal.fire({
        title: action === 'reject' ? 'Rechazar documento' : 'Pedir reenvío',
        input: 'textarea',
        inputLabel: 'Motivo (lo verá el conductor)',
        inputPlaceholder: 'Ej: la foto está borrosa, no se lee la placa…',
        showCancelButton: true,
        confirmButtonText: action === 'reject' ? 'Rechazar' : 'Enviar solicitud',
        cancelButtonText: 'Cancelar',
        inputValidator: (v) => (!v ? 'El motivo es obligatorio' : null),
      });
      if (!isConfirmed) return;
      reason = value;
    }
    setBusy(true);
    try {
      let updated;
      if (action === 'reprocess') {
        updated = await documentService.reprocessDocument(activeDoc._id);
        toast.success('Reprocesando…');
      } else {
        updated = await documentService.reviewDocument(activeDoc._id, { action, reason });
        toast.success('Documento actualizado');
      }
      setDocs(prev => prev.map(d => d._id === updated._id ? { ...d, ...updated } : d));
    } catch (err) {
      console.error('[DocumentReviewPanel] action error:', err);
      toast.error('No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(() => {
    const stats = { total: visibleTypes.length, approved: 0, pending: 0, issues: 0, missing: 0 };
    for (const t of visibleTypes) {
      const d = docsByType[t];
      if (!d) stats.missing++;
      else if (d.status === 'approved') stats.approved++;
      else if (['pending', 'processing'].includes(d.status)) stats.pending++;
      else stats.issues++;
    }
    return stats;
  }, [docsByType, visibleTypes]);

  return (
    <div className="doc-panel">
      <div className="doc-panel-summary">
        <span className="sum approved">{summary.approved} aprobados</span>
        <span className="sum issues">{summary.issues} con observación</span>
        <span className="sum pending">{summary.pending} en cola</span>
        <span className="sum missing">{summary.missing} sin subir</span>
      </div>

      <div className="doc-panel-grid">
        <div className="doc-panel-list">
          {loading
            ? <div className="doc-loading"><Loader2 size={18} className="spin" /> Cargando…</div>
            : visibleTypes.map(type => (
                <DocumentCard
                  key={type}
                  type={type}
                  doc={docsByType[type]}
                  selected={activeType === type}
                  onSelect={setActiveType}
                />
              ))
          }
        </div>
        <div className="doc-panel-detail">
          {loading
            ? null
            : <DetailView
                doc={activeDoc}
                driver={driver}
                vehicle={vehicle}
                onAction={handleAction}
                busy={busy}
              />
          }
        </div>
      </div>
    </div>
  );
};

export default DocumentReviewPanel;
