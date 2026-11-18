import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
  X, Save, Upload, User, Truck, Mail, AtSign, Calendar,
  Users, Palette, CheckCircle, AlertCircle, MapPin, Clock,
  History, Navigation, FileCheck, IdCard,
  Power, PowerOff, Trash2, AlertTriangle, ShieldCheck, Plus, Minus, RefreshCw
} from 'lucide-react';
import driverService from '../../services/driverService';
import passengerService from '../../services/passengerService';
import api from '../../services/api';
import rideService from '../../services/rideService';
import { toast } from 'react-hot-toast';
import { InsertarEnCloudinary } from '../../services/cloudinary';
import DocumentReviewPanel from '../DocumentReviewPanel';
import './DriverProfileModal.css';

const CAR_DATA = {
  Acura: ['MDX', 'RDX', 'TLX', 'TSX', 'Integra'],
  Audi: ['A3', 'A4', 'Q3', 'Q5', 'Q7'],
  BMW: ['Serie 1', 'Serie 3', 'Serie 5', 'X1', 'X3', 'X5'],
  BYD: ['S1 Pro', 'Yuan Plus', 'Tang', 'Song Plus', 'F3', 'Dolphin'],
  Chery: ['Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'QQ'],
  Chevrolet: ['Colorado', 'Tracker', 'Spark', 'Aveo', 'Captiva', 'Groove'],
  Citroen: ['C3', 'C4 Cactus', 'C5 Aircross', 'Berlingo', 'Jumpy'],
  Daihatsu: ['Terios', 'Bego', 'Sirion', 'Delta', 'Gran Max'],
  Dodge: ['RAM 1500', 'RAM 2500', 'Journey', 'Durango', 'Dakota'],
  Fiat: ['Strada', 'Fiorino', 'Pulse', 'Uno', '500', 'Fastback'],
  Ford: ['Ranger', 'Everest', 'Explorer', 'EcoSport', 'F-150', 'Focus'],
  Geely: ['Coolray', 'Azkarra', 'Okavango', 'GX3 Pro', 'Geometry C'],
  GMC: ['Sierra', 'Acadia', 'Terrain', 'Yukon', 'Canyon'],
  GreatWall: ['Wingle 5', 'Wingle 7', 'Poer', 'Haval M4', 'Voleex'],
  Haval: ['H6', 'Jolion', 'H2', 'H9', 'M4'],
  Honda: ['CR-V', 'Civic', 'HR-V', 'Accord', 'Fit', 'Pilot'],
  Hyundai: ['Tucson', 'Accent Blue', 'Elantra', 'Creta', 'Grand i10', 'Santa Fe', 'Kona'],
  Isuzu: ['D-Max', 'MU-X', 'NLR', 'NPR', 'FTR'],
  JAC: ['T8', 'JS2', 'JS4', 'S2', 'Sunray', 'E10X'],
  Jeep: ['Grand Cherokee', 'Wrangler', 'Compass', 'Renegade', 'Cherokee'],
  Jetour: ['Dashing', 'X70 Plus', 'X70', 'X90 Plus'],
  Kia: ['Sportage', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Cerato', 'Soluto'],
  LandRover: ['Defender', 'Discovery', 'Range Rover Evoque', 'Range Rover Sport'],
  Lexus: ['RX', 'NX', 'UX', 'GX', 'IS'],
  Mazda: ['CX-5', 'Mazda 3', 'CX-3', 'CX-30', 'BT-50', 'CX-9'],
  MercedesBenz: ['GLC', 'GLE', 'Clase C', 'Clase A', 'Clase E', 'Vito'],
  MG: ['ZS', 'HS', 'MG3', 'MG5', 'Marvel R', 'MG4'],
  Mitsubishi: ['Montero Sport', 'L200', 'Outlander', 'ASX', 'Eclipse Cross', 'Montero'],
  Nissan: ['Frontier', 'Sentra', 'Qashqai', 'Kicks', 'Versa', 'X-Trail', 'March'],
  Peugeot: ['2008', '3008', '5008', '208', 'Partner', 'Landtrek'],
  Renault: ['Kwid', 'Duster', 'Oroch', 'Stepway', 'Koleos', 'Logan'],
  Subaru: ['XV', 'Forester', 'Outback', 'Impreza', 'Crosstrek'],
  Suzuki: ['Vitara', 'Swift', 'Jimny', 'S-Presso', 'Ertiga', 'Dzire', 'Baleno'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Toyota: ['Hilux', 'Corolla', 'Yaris', 'RAV4', 'Prado', 'Fortuner', 'Rush', 'Agya'],
  Volkswagen: ['Amarok', 'Tiguan', 'Jetta', 'T-Cross', 'Gol', 'Taos', 'Nivus'],
  Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'V40', 'C40'],
};

const BRANDS = Object.keys(CAR_DATA);
const COLORS = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Café', 'Beige', 'Vinilado'];
const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

const COMPANIES = [
  'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian', '3M',
  'DHL', 'Bill Gosling Outsourcing (BGO)', 'WeWork Costa Rica',
  'Concentrix', 'Nestlé Costa Rica'
];

const SCHEDULES = [
  '08:00 - 17:00', '07:00 - 16:00', '06:00 - 15:00',
  '22:00 - 06:00 (Nocturno)', 'Rotativo', 'Fines de semana'
];

const generateTempPassword = () => "SafeRide@" + Math.random().toString(36).slice(-4) + Math.floor(Math.random() * 10);

// ─── Validaciones ──────────────────────────────────────────
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CR_RE = /^[2678]\d{7}$/; // móvil/fijo CR: 8 dígitos, prefijo 2/6/7/8
const NAME_RE     = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-']+$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;
const PLATE_RE    = /^[A-Z0-9]{6}$/;

const validateField = (name, rawValue, { isPassenger } = {}) => {
  const value = rawValue ?? '';
  switch (name) {
    case 'name':
      if (!value.trim())                return 'El nombre es obligatorio';
      if (value.trim().length < 4)      return 'Mínimo 4 caracteres';
      if (!NAME_RE.test(value))         return 'Solo letras, números, espacios, puntos y guiones';
      return null;
    case 'username':
      if (!value)                       return 'El usuario es obligatorio';
      if (value.length < 4)             return 'Mínimo 4 caracteres';
      if (!USERNAME_RE.test(value))     return 'Solo letras, números, puntos, guiones y guiones bajos';
      return null;
    case 'email':
      if (!value)                       return 'El correo es obligatorio';
      if (!EMAIL_RE.test(value))        return 'Correo con formato inválido';
      return null;
    case 'phone':
      if (!value)                       return 'El teléfono es obligatorio';
      if (!PHONE_CR_RE.test(value))     return 'Debe tener 8 dígitos y empezar con 2, 6, 7 u 8';
      return null;
    case 'v-license_plate':
      if (isPassenger) return null;
      if (!value)                                  return 'La placa es obligatoria';
      if (!PLATE_RE.test(value.toUpperCase()))     return 'Placa: 6 caracteres alfanuméricos';
      return null;
    case 'v-model':
      if (isPassenger) return null;
      if (!value)                       return 'El modelo es obligatorio';
      return null;
    default:
      return null;
  }
};

const validateAll = (form, ctx) => {
  const errors = {};
  ['name', 'username', 'email', 'phone'].forEach((f) => {
    const err = validateField(f, form[f], ctx);
    if (err) errors[f] = err;
  });
  if (!ctx.isPassenger) {
    const plateErr = validateField('v-license_plate', form.vehicle?.license_plate, ctx);
    const modelErr = validateField('v-model',         form.vehicle?.model,         ctx);
    if (plateErr) errors['v-license_plate'] = plateErr;
    if (modelErr) errors['v-model']         = modelErr;
  }
  return errors;
};

const FieldError = ({ msg }) => msg ? (
  <span className="field-error">
    <AlertCircle size={12} /> {msg}
  </span>
) : null;

// ─── Iconos SVG inline para usar dentro de Swal.fire({ html: ... }) ──
const svgIcon = (paths, { size = 14, color = '#EF4444' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" `
  + `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" `
  + `style="vertical-align:-2px; flex-shrink:0;">${paths}</svg>`;

const ICONS = {
  alert: (c = '#EF4444') => svgIcon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', { color: c }),
  trash: (c = '#DC2626') => svgIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>', { color: c }),
  lock:  (c = '#DC2626') => svgIcon('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', { color: c }),
};

// Componente interno para items del historial memoizado
const TripItem = memo(({ trip, idx, isLast }) => (
  <div className="trip-history-item">
    <div className="trip-date-indicator">
      <div className="date-dot" />
      {!isLast && <div className="date-line" />}
    </div>
    <div className="trip-card-history">
      <div className="trip-header-h">
        <span className={`trip-status-badge ${trip.status || 'scheduled'}`}>
          {trip.status === 'completed' ? 'Completado' :
            trip.status === 'cancelled' ? 'Cancelado' :
              trip.status === 'in progress' ? 'En Curso' : 'Programado'}
        </span>
        <span className="trip-date-h"><Calendar size={12} /> {trip.fecha || 'N/A'} · {trip.hora || '--:--'}</span>
      </div>
      <div className="trip-route-h">
        <div className="route-step">
          <MapPin size={14} color="#10B981" />
          <div>
            <p className="route-label">Origen</p>
            <p className="route-name">{trip.origin?.name || 'Origen no disponible'}</p>
          </div>
        </div>
        <div className="route-divider-h" />
        <div className="route-step">
          <MapPin size={14} color="#EF4444" />
          <div>
            <p className="route-label">Destino</p>
            <p className="route-name">{trip.destination?.name || 'Destino no disponible'}</p>
          </div>
        </div>
      </div>
      <div className="trip-footer-h">
        <span><Users size={12} /> {trip.available_seats || 0} Asientos</span>
        {trip.distance_km && <span><Navigation size={12} /> {trip.distance_km} km</span>}
      </div>
    </div>
  </div>
));


const DriverProfileModal = ({ isOpen, onClose, driver, onSaved, userType = 'conductor', initialTab = 'info' }) => {
  const isEditMode = Boolean(driver);
  const isPassenger = userType === 'pasajero';
  const [form, setForm] = useState({
    name: '', username: '', email: '', phone: '',
    company: COMPANIES[0] || '', work_schedule: SCHEDULES[0] || '',
    vehicle: {
      brand: BRANDS[0] || '',
      model: (BRANDS[0] && CAR_DATA[BRANDS[0]] && CAR_DATA[BRANDS[0]][0]) || '',
      license_plate: '',
      color: COLORS[0] || '',
      year: YEARS[0] || '',
      capacity: 4
    }
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [emailStatus, setEmailStatus] = useState('idle');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Snapshot del formulario tras la hidratación inicial. Lo usamos para
  // detectar "no hay cambios" en modo edición.
  const initialFormRef = useRef(null);

  // Loading independiente para las acciones de la "zona de riesgo".
  const [dangerLoading, setDangerLoading] = useState(false);

  // TrustScore local: refleja el valor PENDIENTE (lo que se aplicará al guardar).
  // Mientras el modal esté abierto, los botones +/- / restaurar solo modifican
  // este estado y empujan la acción a `pendingTrustOps`. Las llamadas reales
  // a la API se hacen dentro de handleSubmit cuando el admin clickea
  // "Actualizar Perfil". Si cierra sin guardar, se descarta todo (useEffect
  // de hidratación abajo resetea ambos estados).
  const [trustScore, setTrustScore] = useState(driver?.trustScore ?? 4);
  const [pendingTrustOps, setPendingTrustOps] = useState([]);
  const [trustLoading, setTrustLoading] = useState(false);

  useEffect(() => {
    let next;
    if (isEditMode) {
      const v = driver.vehicle || {};
      const brand = v.brand || BRANDS[0];
      next = {
        name: driver.name || '',
        username: driver.username || '',
        email: driver.email || '',
        phone: driver.phone || '',
        company: driver.company || COMPANIES[0],
        work_schedule: driver.work_schedule || SCHEDULES[0],
        vehicle: {
          brand: brand,
          model: v.model || (CAR_DATA[brand] ? CAR_DATA[brand][0] : ''),
          license_plate: v.license_plate || '',
          color: v.color || COLORS[0],
          year: String(v.year || YEARS[0]),
          capacity: v.capacity || 4,
        }
      };
      setPreviewUrl(driver.profileImage || '');
    } else {
      next = {
        name: '', username: '', email: '', phone: '',
        company: COMPANIES[0], work_schedule: SCHEDULES[0],
        vehicle: {
          brand: BRANDS[0],
          model: CAR_DATA[BRANDS[0]] ? CAR_DATA[BRANDS[0]][0] : '',
          license_plate: '',
          color: COLORS[0],
          year: YEARS[0],
          capacity: 4
        }
      };
      setPreviewUrl('');
      setAvatarFile(null);
    }
    setForm(next);
    initialFormRef.current = JSON.stringify(next);
    setUsernameStatus('idle');
    setEmailStatus('idle');
    setStep('');
    setFieldErrors({});
    setTrustScore(driver?.trustScore ?? 4);
    setPendingTrustOps([]); // Descarta cambios pendientes al re-hidratar (abrir/cerrar modal o cambiar de usuario).
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [driver, isEditMode, isOpen, initialTab]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (activeTab === 'history' && driver?._id) {
        setLoadingTrips(true);
        try {
          let res;
          if (isPassenger) {
            res = await rideService.getBookingsByPassenger(driver._id);
            // Normalizamos: en las reservas, los datos del viaje están en .ride
            const normalized = (res.data || []).map(b => ({
              ...b.ride,
              status: b.status, // Usamos el estado de la reserva
              _id: b._id
            }));
            setTrips(normalized);
          } else {
            res = await rideService.getRidesByDriver(driver._id);
            setTrips(res.data || []);
          }
        } catch (err) {
          console.error('Error loading history:', err);
          toast.error('No se pudo cargar el historial');
          setTrips([]);
        } finally {
          setLoadingTrips(false);
        }
      }
    };
    fetchHistory();
  }, [activeTab, driver?._id, isPassenger]);

  // Debounce para verificaciones de unicidad
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!form.username || form.username.length < 4 || isEditMode) return;
      checkUsernameUniqueness(form.username);
    }, 600);
    return () => clearTimeout(timer);
  }, [form.username]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email) || isEditMode) return;
      checkEmailUniqueness(form.email);
    }, 600);
    return () => clearTimeout(timer);
  }, [form.email]);

  const checkUsernameUniqueness = async (val) => {
    setUsernameStatus('checking');
    try {
      const response = await api.get(`/users?search=${val}`);
      const exists = response.data?.data?.some(u => u.username.toLowerCase() === val.toLowerCase());
      setUsernameStatus(exists ? 'taken' : 'available');
    } catch (err) {
      setUsernameStatus('idle');
    }
  };

  const checkEmailUniqueness = async (val) => {
    setEmailStatus('checking');
    try {
      const response = await api.get(`/users?search=${val}`);
      const exists = response.data?.data?.some(u => u.email.toLowerCase() === val.toLowerCase());
      setEmailStatus(exists ? 'taken' : 'available');
    } catch (err) {
      setEmailStatus('idle');
    }
  };

  const handleChange = e => {
    const { name, value } = e.target;
    let nextValue = value;

    if (name === 'name') {
      nextValue = value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-']/g, '');
    }

    if (name.startsWith('v-')) {
      const field = name.replace('v-', '');
      setForm(prev => {
        const newVehicle = { ...prev.vehicle, [field]: nextValue };
        if (field === 'brand') {
          newVehicle.model = CAR_DATA[nextValue] ? CAR_DATA[nextValue][0] : '';
        }
        return { ...prev, vehicle: newVehicle };
      });
    } else {
      setForm(prev => ({ ...prev, [name]: nextValue }));
      if (name === 'username' && !isEditMode) setUsernameStatus('idle');
      if (name === 'email' && !isEditMode) setEmailStatus('idle');
    }

    // Validación inline: solo mostramos error si el campo ya tiene contenido,
    // así no marcamos en rojo apenas abre el modal con todo vacío.
    if (nextValue) {
      const err = validateField(name, nextValue, { isPassenger });
      setFieldErrors(prev => ({ ...prev, [name]: err }));
    } else {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const hasChanges = () => {
    if (!isEditMode)       return true;
    if (avatarFile)        return true;
    if (pendingTrustOps.length > 0) return true; // hay cambios de trust por aplicar
    if (!initialFormRef.current) return true;
    return JSON.stringify(form) !== initialFormRef.current;
  };

  const showValidationAlert = (errors) => {
    const items = Object.values(errors).filter(Boolean);
    return Swal.fire({
      icon: 'warning',
      title: 'Revisa los datos del formulario',
      html: `
        <p style="margin: 0 0 12px; color: #475569;">
          Hay ${items.length} ${items.length === 1 ? 'campo' : 'campos'} que necesita${items.length === 1 ? '' : 'n'} atención:
        </p>
        <ul style="list-style:none; text-align:left; padding:0; margin:0; color:#1E293B; line-height:1.5;">
          ${items.map((e) => `
            <li style="display:flex; align-items:flex-start; gap:8px; padding:6px 10px; margin-bottom:4px; background:#FEF2F2; border-radius:6px;">
              ${ICONS.alert('#EF4444')}
              <span>${e}</span>
            </li>
          `).join('')}
        </ul>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#EF4444',
      background: 'rgba(255, 255, 255, 0.95)',
      backdrop: 'blur(4px)',
      customClass: { container: 'swal-over-modal' },
    });
  };

  const showNoChangesAlert = () => Swal.fire({
    icon: 'info',
    title: 'No hay cambios para guardar',
    text: 'Modifica al menos un campo antes de actualizar el perfil.',
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#2563EB',
    background: 'rgba(255, 255, 255, 0.95)',
    backdrop: 'blur(4px)',
    customClass: { container: 'swal-over-modal' },
  });

  // ─── Zona de Riesgo: desactivar / activar / eliminar permanente ───
  const SWAL_OVER = { customClass: { container: 'swal-over-modal' } };
  const userLabel = isPassenger ? 'pasajero' : 'conductor';

  const handleDeactivate = async () => {
    const step1 = await Swal.fire({
      ...SWAL_OVER,
      icon: 'warning',
      title: `¿Desactivar ${userLabel}?`,
      text: `${driver.name} no podrá iniciar sesión ni usar la plataforma hasta que lo reactives.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#F59E0B',
      cancelButtonColor: '#64748B',
    });
    if (!step1.isConfirmed) return;

    const step2 = await Swal.fire({
      ...SWAL_OVER,
      icon: 'question',
      title: 'Confirmación final',
      text: '¿Estás absolutamente seguro? Esta acción se puede revertir, pero requiere intervención manual.',
      showCancelButton: true,
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
    });
    if (!step2.isConfirmed) return;

    setDangerLoading(true);
    try {
      if (isPassenger) await passengerService.deletePassenger(driver._id);
      else             await driverService.deleteDriver(driver._id);
      toast.success(`${userLabel.charAt(0).toUpperCase() + userLabel.slice(1)} desactivado`);
      onSaved();
      onClose();
    } catch (err) {
      console.error('Deactivate error:', err);
      toast.error('No se pudo desactivar: ' + (err.response?.data?.message || err.message));
    } finally {
      setDangerLoading(false);
    }
  };

  const handleActivateInModal = async () => {
    const r = await Swal.fire({
      ...SWAL_OVER,
      icon: 'question',
      title: `¿Reactivar ${userLabel}?`,
      text: `${driver.name} podrá volver a usar la plataforma.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, activar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#64748B',
    });
    if (!r.isConfirmed) return;

    setDangerLoading(true);
    try {
      if (isPassenger) await passengerService.activatePassenger(driver._id);
      else             await driverService.activateDriver(driver._id);
      toast.success(`${userLabel.charAt(0).toUpperCase() + userLabel.slice(1)} reactivado`);
      onSaved();
      onClose();
    } catch (err) {

      
      console.error('Activate error:', err);
      toast.error('No se pudo reactivar: ' + (err.response?.data?.message || err.message));
    } finally {
      setDangerLoading(false);
    }
  };

  const handleHardDelete = async () => {
    const step1 = await Swal.fire({
      ...SWAL_OVER,
      icon: 'warning',
      iconColor: '#DC2626',
      title: 'Eliminar permanentemente',
      html: `
        <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; background:#FEF2F2; border-left:3px solid #DC2626; border-radius:4px; margin-bottom:12px;">
          ${ICONS.alert('#DC2626')}
          <strong style="color:#B91C1C;">Esta acción NO se puede deshacer.</strong>
        </div>
        <div style="display:flex; align-items:flex-start; gap:8px; color:#475569; font-size:0.9rem; text-align:left;">
          ${ICONS.trash('#94A3B8')}
          <span>Se borrarán todos los datos de <strong>${driver.name}</strong> del sistema: perfil, historial de viajes${isPassenger ? '' : ', vehículo y documentos'}.</span>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#64748B',
    });
    if (!step1.isConfirmed) return;

    const step2 = await Swal.fire({
      ...SWAL_OVER,
      icon: 'error',
      title: 'Última confirmación',
      html: `
        <div style="display:flex; align-items:center; gap:8px; justify-content:center; margin-bottom:8px;">
          ${ICONS.lock('#DC2626')}
          <span style="color:#475569;">Para borrar definitivamente, escribe el nombre exacto:</span>
        </div>
        <strong style="color:#0F172A; font-size:1.05rem;">${driver.name}</strong>
      `,
      input: 'text',
      inputPlaceholder: 'Escribe el nombre completo',
      showCancelButton: true,
      confirmButtonText: 'Eliminar para siempre',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#64748B',
      inputValidator: (value) => {
        if ((value || '').trim() !== driver.name) return 'El nombre no coincide exactamente';
        return null;
      },
    });
    if (!step2.isConfirmed) return;

    setDangerLoading(true);
    try {
      if (isPassenger) await passengerService.hardDeletePassenger(driver._id);
      else             await driverService.hardDeleteDriver(driver._id);
      await Swal.fire({
        ...SWAL_OVER,
        icon: 'success',
        title: 'Eliminado',
        text: `${driver.name} fue borrado permanentemente del sistema.`,
        confirmButtonColor: '#2563EB',
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error('Hard delete error:', err);
      toast.error('No se pudo eliminar: ' + (err.response?.data?.message || err.message));
    } finally {
      setDangerLoading(false);
    }
  };

  // NOTA: handleTrust ya NO llama a la API. Solo modifica el score mostrado
  // y empuja la operación a pendingTrustOps. La aplicación real al backend
  // ocurre dentro de handleSubmit cuando el admin guarda el perfil.
  // Esto permite que el admin pueda cambiar de opinión (cerrar el modal sin
  // guardar descarta todos los pendientes vía el useEffect de hidratación).
  const handleTrust = async (action) => {
    console.log('[Trust] handleTrust called with action=', action, 'currentScore=', trustScore);
    const isReset     = action === 'reset';
    const isDecrement = action === 'decrement';

    // Guards: cada acción tiene un piso/techo distinto.
    //   increment/reset → no tiene sentido si ya está en 4
    //   decrement       → no tiene sentido si ya está en 0
    if (!isDecrement && trustScore >= 4) {
      console.log('[Trust] early-return: trustScore at max');
      return;
    }
    if (isDecrement && trustScore <= 0) {
      console.log('[Trust] early-return: trustScore at min');
      return;
    }

    const nextScore = isReset
      ? 4
      : (isDecrement ? Math.max(trustScore - 1, 0) : Math.min(trustScore + 1, 4));

    // Warning extra cuando el decremento lleva al usuario a 0 (cuenta se desactiva).
    const willDeactivate = isDecrement && nextScore === 0;

    let title, text, confirmText, confirmColor, icon;
    if (isReset) {
      title = '¿Restaurar al máximo?';
      text  = `${driver.name} tendrá 4 puntos de confianza cuando guardes el perfil.`;
      confirmText  = 'Sí, marcar para guardar';
      confirmColor = '#10B981';
      icon = 'question';
    } else if (isDecrement) {
      title = willDeactivate ? '¿Bajar a 0 y desactivar?' : '¿Bajar un punto?';
      text  = willDeactivate
        ? `${driver.name} pasará a 0 puntos y su cuenta quedará desactivada cuando guardes el perfil.`
        : `${driver.name} pasará de ${trustScore} a ${nextScore} puntos cuando guardes el perfil.`;
      confirmText  = willDeactivate ? 'Sí, marcar para guardar' : 'Sí, marcar';
      confirmColor = '#EF4444';
      icon = willDeactivate ? 'warning' : 'question';
    } else {
      title = '¿Sumar un punto?';
      text  = `${driver.name} pasará de ${trustScore} a ${nextScore} puntos cuando guardes el perfil.`;
      confirmText  = 'Sí, marcar';
      confirmColor = '#10B981';
      icon = 'question';
    }

    const r = await Swal.fire({
      ...SWAL_OVER,
      icon,
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#64748B',
      focusCancel: isDecrement,
    });
    if (!r.isConfirmed) return;

    // Buffer local — la API se llama en handleSubmit.
    setTrustScore(nextScore);
    setPendingTrustOps(prev => {
      const updated = [...prev, action];
      console.log('[Trust] buffered op:', action, '→ queue:', updated, 'nextScore:', nextScore);
      return updated;
    });
  };

  // Descarta cambios de trust pendientes sin tocar la API.
  // Usado por el botón "Descartar cambios" en la sección de trust.
  const discardPendingTrust = () => {
    setPendingTrustOps([]);
    setTrustScore(driver?.trustScore ?? 4);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    console.log('[Submit] start. pendingTrustOps=', pendingTrustOps, 'isEditMode=', isEditMode);

    const errors = validateAll(form, { isPassenger });
    if (!isEditMode) {
      if (emailStatus === 'taken')    errors.email    = 'Este correo ya está registrado';
      if (usernameStatus === 'taken') errors.username = 'Este nombre de usuario ya está en uso';
    }
    if (Object.keys(errors).length > 0) {
      console.log('[Submit] aborted: validation errors', errors);
      setFieldErrors(errors);
      showValidationAlert(errors);
      return;
    }

    if (!hasChanges()) {
      console.log('[Submit] aborted: hasChanges()=false. pendingTrustOps=', pendingTrustOps);
      showNoChangesAlert();
      return;
    }
    console.log('[Submit] validations passed, proceeding to API calls');

    setSubmitting(true);
    try {
      let savedDriverId = driver ? driver._id : null;
      let profileImageUrl = null;

      if (avatarFile) {
        setStep('Subiendo imagen a Cloudinary...');
        profileImageUrl = await InsertarEnCloudinary(avatarFile);
      }

      if (!isEditMode) {
        setStep('Registrando usuario...');
        const userPayload = { ...form, password: generateTempPassword(), type: userType };
        delete userPayload.vehicle;
        if (profileImageUrl) {
          userPayload.profileImage = profileImageUrl;
        }

        const regRes = await api.post('/auth/register', userPayload);
        savedDriverId = regRes.data?.data?.user?._id;

        if (!savedDriverId) throw new Error('No se pudo obtener el ID del nuevo usuario');

        if (!isPassenger) {
          setStep('Registrando vehículo...');
          const vehiclePayload = {
            ...form.vehicle,
            license_plate: form.vehicle.license_plate.toUpperCase(),
            year: parseInt(form.vehicle.year),
            capacity: parseInt(form.vehicle.capacity),
            driver_id: savedDriverId
          };
          await api.post('/vehicles', vehiclePayload);
        }

        setStep('Enviando invitación...');
        await api.post('/auth/send-verification-code', { email: form.email });
      } else {
        setStep('Actualizando datos personales...');
        const userUpdatePayload = {
          name: form.name,
          phone: form.phone,
          company: form.company,
          work_schedule: form.work_schedule
        };
        if (profileImageUrl) {
          userUpdatePayload.profileImage = profileImageUrl;
        }

        if (isPassenger) {
          await passengerService.updatePassenger(savedDriverId, userUpdatePayload);
        } else {
          await driverService.updateDriver(savedDriverId, userUpdatePayload);

          const vehicleId = driver.vehicle?._id || driver.vehicle;
          if (vehicleId) {
            setStep('Actualizando vehículo...');
            const targetVehicleId = typeof vehicleId === 'object' ? vehicleId._id : vehicleId;
            const vehicleUpdate = {
              brand: form.vehicle.brand,
              model: form.vehicle.model,
              license_plate: form.vehicle.license_plate.toUpperCase(),
              color: form.vehicle.color,
              year: parseInt(form.vehicle.year),
              capacity: parseInt(form.vehicle.capacity)
            };
            await api.put(`/vehicles/${targetVehicleId}`, vehicleUpdate);
          } else {
            setStep('Creando vehículo faltante...');
            const vehiclePayload = {
              ...form.vehicle,
              license_plate: form.vehicle.license_plate.toUpperCase(),
              year: parseInt(form.vehicle.year),
              capacity: parseInt(form.vehicle.capacity),
              driver_id: savedDriverId
            };
            await api.post('/vehicles', vehiclePayload);
          }
        }
      }

      // Aplica las operaciones de trust pendientes (acumuladas mientras el
      // admin clickeaba +1 / Bajar 1 / Restaurar). Se ejecutan secuencialmente
      // contra PATCH /users/:id/trust. Cada una queda registrada en TrustHistory
      // con su propia razón (admin_increment / admin_decrement / admin_reset).
      // Solo aplica en modo edición — en registro nuevo el usuario ya nace con
      // trustScore=4 por default y no hay nada que ajustar antes de guardar.
      // Importante: usamos try/catch propio aquí para que un error de trust
      // NO sea enmascarado por el catch general "Error: ..." (que el admin
      // confunde con un fallo del perfil completo). Si una op falla, se
      // muestra toast específico, se mantiene la cola pendiente y NO se cierra
      // el modal — así el admin puede reintentar.
      if (isEditMode && pendingTrustOps.length > 0 && savedDriverId) {
        setStep('Aplicando cambios de confianza...');
        const updateTrustFn = isPassenger
          ? passengerService.updateTrust
          : driverService.updateTrust;
        try {
          for (const op of pendingTrustOps) {
            const res = await updateTrustFn(savedDriverId, op);
            console.log('[Trust] op:', op, '→', res?.trust);
          }
          setPendingTrustOps([]);
        } catch (trustErr) {
          console.error('[Trust] update failed:', trustErr.response?.data || trustErr);
          const msg = trustErr.response?.data?.message || trustErr.message;
          toast.error('Perfil guardado pero falló el cambio de confianza: ' + msg);
          setSubmitting(false);
          setStep('');
          return; // no cerramos el modal — el admin ve los cambios pendientes y puede reintentar
        }
      }

      toast.success(isEditMode ? 'Perfil actualizado' : 'Registro exitoso');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save error details:', err.response?.data || err);
      const backendError = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || err.message;
      toast.error('Error: ' + backendError);
    } finally {
      setSubmitting(false);
      setStep('');
    }
  };

  const currentModels = useMemo(() => {
    if (!form.vehicle?.brand) return [];
    return CAR_DATA[form.vehicle.brand] || [];
  }, [form.vehicle?.brand]);

  if (!isOpen) return null;


  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-glass ${activeTab === 'documents' ? 'is-wide' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>
            {activeTab === 'history'
              ? `Historial de Viajes: ${driver?.name || ''}`
              : activeTab === 'documents'
                ? `Documentos: ${driver?.name || ''}`
                : (isEditMode ? `Editar Perfil ${isPassenger ? 'Pasajero' : 'Conductor'}` : 'Nuevo Registro')}
          </h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </header>

        {isEditMode && (
          <nav className="modal-tabs" role="tablist">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <User size={14} /> Información
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={14} /> Historial
            </button>
            {!isPassenger && (
              <button
                type="button"
                className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveTab('documents')}
              >
                <FileCheck size={14} /> Documentos
              </button>
            )}
          </nav>
        )}

        {activeTab === 'info' ? (
          <form className="modal-body" onSubmit={handleSubmit}>
            <div className="avatar-section">
              <img src={previewUrl || 'https://via.placeholder.com/150'} alt="Avatar" className="avatar-preview" />
              <label className="file-label">
                <Upload size={16} /> <span>{isEditMode ? 'Cambiar foto' : 'Subir foto (opcional)'}</span>
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files[0];
                  if (file) { setAvatarFile(file); setPreviewUrl(URL.createObjectURL(file)); }
                }} />
              </label>
            </div>

            <div className="section-title"><Mail size={14} /> Datos de Cuenta</div>
            <div className="field-group">
              <label>Correo Electrónico</label>
              <div className="username-input-wrapper">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  readOnly={isEditMode}
                  className={`${isEditMode ? 'input-readonly' : ''} ${fieldErrors.email || (!isEditMode && emailStatus === 'taken') ? 'has-error' : ''}`}
                />
                {!isEditMode && (
                  <div className="username-status-icon">
                    {emailStatus === 'checking' && <div className="spinner-mini" />}
                    {emailStatus === 'available' && <CheckCircle size={16} color="#10B981" />}
                    {emailStatus === 'taken' && <AlertCircle size={16} color="#EF4444" />}
                  </div>
                )}
              </div>
              <FieldError msg={fieldErrors.email || (!isEditMode && emailStatus === 'taken' ? 'Este correo ya está registrado' : null)} />
            </div>
            <div className="field-group">
              <label>Nombre de Usuario</label>
              <div className="username-input-wrapper">
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  readOnly={isEditMode}
                  className={`${isEditMode ? 'input-readonly' : ''} ${fieldErrors.username || (!isEditMode && usernameStatus === 'taken') ? 'has-error' : ''}`}
                />
                {!isEditMode && (
                  <div className="username-status-icon">
                    {usernameStatus === 'checking' && <div className="spinner-mini" />}
                    {usernameStatus === 'available' && <CheckCircle size={16} color="#10B981" />}
                    {usernameStatus === 'taken' && <AlertCircle size={16} color="#EF4444" />}
                  </div>
                )}
              </div>
              <FieldError msg={fieldErrors.username || (!isEditMode && usernameStatus === 'taken' ? 'Este nombre de usuario ya está en uso' : null)} />
            </div>

            <div className="section-title"><User size={14} /> Información Personal</div>
            <div className="field-group">
              <label>Nombre Completo *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className={fieldErrors.name ? 'has-error' : ''}
              />
              <FieldError msg={fieldErrors.name} />
            </div>
            <div className="field-group">
              <label>Teléfono (8 dígitos, CR) *</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                maxLength={8}
                inputMode="numeric"
                className={fieldErrors.phone ? 'has-error' : ''}
              />
              <FieldError msg={fieldErrors.phone} />
            </div>
            <div className="field-group">
              <label>Empresa *</label>
              <select name="company" value={form.company} onChange={handleChange}>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Horario *</label>
              <select name="work_schedule" value={form.work_schedule} onChange={handleChange}>
                {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {!isPassenger && (
              <>
                <div className="section-title"><Truck size={14} /> Información del Vehículo</div>
                <div className="field-group">
                  <label>Marca *</label>
                  <select name="v-brand" value={form.vehicle.brand} onChange={handleChange}>
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Modelo *</label>
                  <select name="v-model" value={form.vehicle.model} onChange={handleChange}>
                    {currentModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Placa (6 Caracteres) *</label>
                  <input
                    name="v-license_plate"
                    value={form.vehicle.license_plate}
                    onChange={handleChange}
                    maxLength={6}
                    style={{ textTransform: 'uppercase' }}
                    className={fieldErrors['v-license_plate'] ? 'has-error' : ''}
                  />
                  <FieldError msg={fieldErrors['v-license_plate']} />
                </div>
                <div className="field-group">
                  <label>Color *</label>
                  <select name="v-color" value={form.vehicle.color} onChange={handleChange}>
                    {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label><Calendar size={12} /> Año *</label>
                  <select name="v-year" value={form.vehicle.year} onChange={handleChange}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label><Users size={12} /> Capacidad *</label>
                  <input type="number" name="v-capacity" value={form.vehicle.capacity} onChange={handleChange} min="1" max="7" />
                </div>
              </>
            )}

            {isEditMode && (
              <>
                <div className="section-title"><ShieldCheck size={14} /> Puntaje de Confianza</div>
                <div className="trust-section">
                  <div className="trust-score-display">
                    <div className="trust-dots" aria-label={`Puntaje ${trustScore} de 4`}>
                      {[0, 1, 2, 3].map(i => (
                        <span key={i} className={`trust-dot ${i < trustScore ? 'filled' : ''}`} />
                      ))}
                    </div>
                    <span className="trust-score-text">
                      {trustScore} / 4
                      {pendingTrustOps.length > 0 && (
                        <span style={{
                          marginLeft: 8, fontSize: '0.72rem', fontWeight: 600,
                          color: '#B45309', background: '#FEF3C7',
                          padding: '2px 8px', borderRadius: 4,
                        }}>
                          {pendingTrustOps.length} cambio{pendingTrustOps.length === 1 ? '' : 's'} pendiente{pendingTrustOps.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="trust-help">
                    Los puntos se descuentan automáticamente por mala conducta. El admin puede subirlos, bajarlos o restaurarlos al máximo.
                    {pendingTrustOps.length > 0 && (
                      <>
                        {' '}<strong>Los cambios marcados se aplicarán al presionar "Actualizar Perfil".</strong>
                      </>
                    )}
                  </p>
                  <div className="trust-buttons">
                    <button
                      type="button"
                      className="btn-trust-inc"
                      onClick={() => handleTrust('increment')}
                      disabled={trustScore >= 4 || trustLoading || submitting || dangerLoading}
                    >
                      <Plus size={14} /> Sumar 1
                    </button>
                    <button
                      type="button"
                      className="btn-trust-dec"
                      onClick={() => handleTrust('decrement')}
                      disabled={trustScore <= 0 || trustLoading || submitting || dangerLoading}
                      title={trustScore <= 0 ? 'Ya está en el mínimo' : 'Bajar un punto'}
                    >
                      <Minus size={14} /> Bajar 1
                    </button>
                    <button
                      type="button"
                      className="btn-trust-reset"
                      onClick={() => handleTrust('reset')}
                      disabled={trustScore >= 4 || trustLoading || submitting || dangerLoading}
                    >
                      <RefreshCw size={14} /> Restaurar al máximo
                    </button>
                  </div>
                  {pendingTrustOps.length > 0 && (
                    <button
                      type="button"
                      onClick={discardPendingTrust}
                      disabled={submitting || dangerLoading}
                      style={{
                        marginTop: 8, padding: '6px 12px', fontSize: '0.78rem',
                        color: '#64748B', background: 'transparent',
                        border: '1px solid #CBD5E1', borderRadius: 4,
                        cursor: 'pointer', fontWeight: 500,
                      }}
                    >
                      Descartar cambios pendientes
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="modal-footer">
              <button
                type="submit"
                className="save-btn"
                disabled={
                  submitting
                  || dangerLoading
                  || trustLoading
                  || (!isEditMode && (usernameStatus === 'checking' || emailStatus === 'checking'))
                  || (!isEditMode && (usernameStatus === 'taken' || emailStatus === 'taken'))
                  || Object.values(fieldErrors).some(Boolean)
                }
              >
                {submitting ? step : (isEditMode ? 'Actualizar Perfil' : 'Completar Registro')}
              </button>

              {isEditMode && (
                <div className="danger-zone">
                  <div className="danger-zone-title">
                    <AlertTriangle size={14} /> Zona de Riesgo
                  </div>
                  <div className="danger-zone-buttons">
                    {driver?.isActive ? (
                      <button
                        type="button"
                        className="btn-deactivate"
                        onClick={handleDeactivate}
                        disabled={submitting || dangerLoading || trustLoading}
                      >
                        <PowerOff size={14} /> Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-activate"
                        onClick={handleActivateInModal}
                        disabled={submitting || dangerLoading || trustLoading}
                      >
                        <Power size={14} /> Activar
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-hard-delete"
                      onClick={handleHardDelete}
                      disabled={submitting || dangerLoading || trustLoading}
                    >
                      <Trash2 size={14} /> Eliminar por completo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        ) : activeTab === 'documents' ? (
          <div className="modal-body documents-body">
            <DocumentReviewPanel
              driver={driver}
              vehicle={driver?.vehicle}
            />
          </div>
        ) : (
          <div className="modal-body history-body">
            {loadingTrips ? (
              <div className="loading-trips">
                <div className="spinner-dashboard" />
                <p>Cargando historial de viajes...</p>
              </div>
            ) : trips.length > 0 ? (
              <div className="trips-timeline">
                {trips.map((trip, idx) => (
                  <TripItem
                    key={trip._id || idx}
                    trip={trip}
                    idx={idx}
                    isLast={idx === trips.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-trips">
                <History size={48} />
                <p>Este {isPassenger ? 'pasajero' : 'conductor'} aún no registra actividad.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DriverProfileModal;
