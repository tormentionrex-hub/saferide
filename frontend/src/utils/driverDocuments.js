// Los 6 documentos que el panel exige para activar el vehículo del conductor.
// Los campos son los que lee el motor de reglas del backend
// (documentValidationService): si faltan, el documento queda en revisión manual.

const name = { key: 'fullName', label: 'Nombre como aparece en el documento', placeholder: 'Nombre completo', max: 80 };
const plate = { key: 'licensePlate', label: 'Placa', placeholder: 'ABC123', caps: 'characters', max: 6 };
const brand = { key: 'vehicleBrand', label: 'Marca', placeholder: 'Toyota', max: 40 };
const model = { key: 'vehicleModel', label: 'Modelo', placeholder: 'Corolla', max: 40 };
const expiry = { key: 'expiryDate', label: 'Fecha de vencimiento', kind: 'date' };

export const DOCUMENT_FORMS = {
    cedula: {
        label: 'Cédula de identidad',
        help: 'Foto del frente de tu cédula, legible y sin reflejos.',
        fields: [
            { key: 'documentNumber', label: 'Número de cédula', placeholder: '1-2345-6789', keyboard: 'numbers-and-punctuation', caps: 'none', max: 20 },
            name,
            expiry,
        ],
    },
    licencia: {
        label: 'Licencia de conducir',
        help: 'Foto del frente de tu licencia vigente.',
        fields: [
            { key: 'licenseNumber', label: 'Número de licencia', placeholder: '1-2345-6789', keyboard: 'numbers-and-punctuation', caps: 'none', max: 20 },
            { key: 'licenseClass', label: 'Clase de licencia', placeholder: 'B1', caps: 'characters', max: 5 },
            name,
            { key: 'documentNumber', label: 'Número de cédula', placeholder: '1-2345-6789', keyboard: 'numbers-and-punctuation', caps: 'none', max: 20 },
            expiry,
        ],
    },
    poliza: {
        label: 'Póliza de seguro',
        help: 'Certificado de la póliza del vehículo.',
        fields: [
            { key: 'policyNumber', label: 'Número de póliza', placeholder: 'POL-99283-X', caps: 'characters', max: 20 },
            { key: 'insurer', label: 'Aseguradora', placeholder: 'INS', max: 40 },
            { ...name, key: 'policyHolder', label: 'Titular de la póliza' },
            plate,
            expiry,
        ],
    },
    marchamo: {
        label: 'Marchamo',
        help: 'Comprobante del marchamo del año en curso.',
        fields: [
            plate,
            brand,
            model,
            { key: 'vehicleYear', label: 'Año del vehículo', placeholder: '2021', keyboard: 'number-pad', caps: 'none', max: 4 },
            { key: 'marchamoYear', label: 'Año del marchamo', placeholder: String(new Date().getFullYear()), keyboard: 'number-pad', caps: 'none', max: 4 },
            expiry,
        ],
    },
    rtv: {
        label: 'RTV (Dekra)',
        help: 'Certificado de la revisión técnica vehicular vigente.',
        fields: [
            { key: 'rtvNumber', label: 'Número de certificado', placeholder: 'RTV-123456', caps: 'characters', max: 20 },
            plate,
            brand,
            model,
            expiry,
        ],
    },
    tarjeta_circulacion: {
        label: 'Tarjeta de circulación',
        help: 'Foto de la tarjeta de circulación del vehículo.',
        fields: [{ ...name, label: 'Nombre del titular' }, plate, brand, model],
    },
};

export const STATUS_INFO = {
    missing: { label: 'Sin subir', icon: 'cloud-upload-outline' },
    pending: { label: 'En cola', icon: 'time-outline' },
    processing: { label: 'Verificando', icon: 'sync-outline' },
    needs_review: { label: 'Revisión manual', icon: 'eye-outline' },
    rejected: { label: 'Rechazado', icon: 'close-circle-outline' },
    approved: { label: 'Aprobado', icon: 'checkmark-circle' },
};

// Valores iniciales: lo que ya se envió antes, o lo que se conoce de la cuenta
// y del vehículo (la persona lo confirma o lo corrige).
export const buildInitialValues = (type, { driverName = '', vehicle = null, cedulaNumber = '', previous = {} } = {}) => {
    const form = DOCUMENT_FORMS[type];
    if (!form) return {};
    const known = {
        fullName: driverName,
        policyHolder: driverName,
        licensePlate: vehicle?.license_plate || '',
        vehicleBrand: vehicle?.brand || '',
        vehicleModel: vehicle?.model || '',
        vehicleYear: vehicle?.year ? String(vehicle.year) : '',
        marchamoYear: String(new Date().getFullYear()),
        documentNumber: type === 'licencia' ? cedulaNumber : '',
    };
    const values = {};
    for (const field of form.fields) {
        const prev = previous?.[field.key];
        values[field.key] = prev !== undefined && prev !== null && prev !== '' ? String(prev) : (known[field.key] || '');
    }
    return values;
};

const UNSAFE = /[<>\u0000-\u001F\u007F]/;

// Devuelve el primer error en español, o null si el formulario está completo.
export const validateDocumentForm = (type, values, hasImage, now = new Date()) => {
    const form = DOCUMENT_FORMS[type];
    if (!form) return 'Tipo de documento no válido.';
    if (!hasImage) return 'Agrega una foto del documento.';
    for (const field of form.fields) {
        const raw = values?.[field.key];
        const value = raw === undefined || raw === null ? '' : String(raw).trim();
        if (!value) return `Completa: ${field.label.toLowerCase()}.`;
        if (UNSAFE.test(value)) return `${field.label} tiene caracteres no permitidos.`;
        if (field.kind === 'date') {
            const time = Date.parse(value);
            if (Number.isNaN(time)) return `${field.label} no es una fecha válida.`;
            if (time <= now.getTime()) return 'El documento está vencido: la fecha de vencimiento debe ser futura.';
        }
        if (field.key === 'licensePlate' && !/^(?=.*[0-9])[A-Z0-9]{6}$/i.test(value)) {
            return 'La placa debe tener 6 caracteres alfanuméricos e incluir al menos un número.';
        }
        if ((field.key === 'vehicleYear' || field.key === 'marchamoYear') && !/^\d{4}$/.test(value)) {
            return `${field.label} debe tener 4 dígitos.`;
        }
    }
    return null;
};

export const countApproved = (details = []) => details.filter((d) => d?.approved).length;
