const { Document, User, Vehicle } = require('../models');

const RULES_VERSION = 'rules-engine-v1';

const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isFutureDate = (value) => {
    const time = Date.parse(value);
    return !Number.isNaN(time) && time > Date.now();
};

const evaluateDocument = (document, context = {}) => {
    const data = document.extractedData || {};
    const driver = context.driver || {};
    const vehicle = context.vehicle || null;
    const cedulaDocument = context.cedulaDocument || null;
    const checks = [];
    const failures = [];
    const missing = [];

    const addCheck = (rule, passed, reason = '') => {
        checks.push({ rule, passed, reason });
        if (passed || !reason) return;
        if (reason.startsWith('Falta') || reason.startsWith('No hay')) missing.push(reason);
        else failures.push(reason);
    };

    const requireField = (value, label) => {
        if (!hasValue(value)) {
            addCheck(`Dato presente: ${label}`, false, `Falta ${label.toLowerCase()}`);
            return false;
        }
        addCheck(`Dato presente: ${label}`, true);
        return true;
    };

    const compareField = (value, expected, rule, label, expectedLabel = label) => {
        if (!requireField(value, label)) return;
        if (!hasValue(expected)) {
            addCheck(rule, false, `No hay ${expectedLabel.toLowerCase()} en el sistema para comparar`);
            return;
        }
        const valueText = normalize(value);
        const expectedText = normalize(expected);
        const passed = valueText === expectedText
            || valueText.includes(expectedText)
            || expectedText.includes(valueText);
        addCheck(rule, passed, passed ? '' : `${label} no coincide con ${expectedLabel}: ${expected}`);
    };

    const checkExpiry = () => {
        if (!requireField(data.expiryDate, 'Fecha de vencimiento')) return;
        const passed = isFutureDate(data.expiryDate);
        addCheck('Vigencia', passed, passed ? '' : `Fecha de vencimiento vencida: ${data.expiryDate}`);
    };

    const useVehicle = () => {
        if (vehicle) return true;
        addCheck('Vehículo activo del conductor', false, 'No hay vehículo activo en el sistema para comparar');
        return false;
    };

    switch (document.type) {
        case 'cedula':
            requireField(data.documentNumber, 'Número de cédula');
            compareField(data.fullName, driver.name, 'Nombre coincide con el registro', 'Nombre', 'nombre del conductor');
            checkExpiry();
            break;
        case 'licencia':
            requireField(data.licenseNumber, 'Número de licencia');
            requireField(data.licenseClass, 'Clase de licencia');
            compareField(data.fullName, driver.name, 'Nombre coincide con el registro', 'Nombre', 'nombre del conductor');
            compareField(
                data.documentNumber,
                cedulaDocument?.extractedData?.documentNumber,
                'Cédula coincide con el documento de identidad',
                'Número de cédula',
                'número de cédula registrado'
            );
            checkExpiry();
            break;
        case 'poliza':
            requireField(data.policyNumber, 'Número de póliza');
            requireField(data.insurer, 'Aseguradora');
            compareField(data.policyHolder, driver.name, 'Titular coincide con el registro', 'Titular', 'nombre del conductor');
            if (useVehicle()) {
                compareField(data.licensePlate, vehicle.license_plate, 'Placa coincide con el sistema', 'Placa', 'placa registrada');
            }
            checkExpiry();
            break;
        case 'marchamo':
            if (useVehicle()) {
                compareField(data.licensePlate, vehicle.license_plate, 'Placa coincide con el sistema', 'Placa', 'placa registrada');
                compareField(data.vehicleBrand, vehicle.brand, 'Marca coincide con el sistema', 'Marca', 'marca registrada');
                compareField(data.vehicleModel, vehicle.model, 'Modelo coincide con el sistema', 'Modelo', 'modelo registrado');
                compareField(data.vehicleYear, vehicle.year, 'Año coincide con el sistema', 'Año', 'año registrado');
            }
            compareField(
                data.marchamoYear,
                String(new Date().getFullYear()),
                'Año del marchamo es vigente',
                'Año del marchamo',
                'año actual'
            );
            checkExpiry();
            break;
        case 'rtv':
            requireField(data.rtvNumber, 'Número de certificado');
            if (useVehicle()) {
                compareField(data.licensePlate, vehicle.license_plate, 'Placa coincide con el sistema', 'Placa', 'placa registrada');
                compareField(data.vehicleBrand, vehicle.brand, 'Marca coincide con el sistema', 'Marca', 'marca registrada');
                compareField(data.vehicleModel, vehicle.model, 'Modelo coincide con el sistema', 'Modelo', 'modelo registrado');
            }
            checkExpiry();
            break;
        case 'tarjeta_circulacion':
            compareField(data.fullName, driver.name, 'Titular coincide con el registro', 'Titular', 'nombre del conductor');
            if (useVehicle()) {
                compareField(data.licensePlate, vehicle.license_plate, 'Placa coincide con el sistema', 'Placa', 'placa registrada');
                compareField(data.vehicleBrand, vehicle.brand, 'Marca coincide con el sistema', 'Marca', 'marca registrada');
                compareField(data.vehicleModel, vehicle.model, 'Modelo coincide con el sistema', 'Modelo', 'modelo registrado');
            }
            break;
        default:
            addCheck('Tipo de documento soportado', false, `Tipo de documento no soportado: ${document.type}`);
            break;
    }

    if (checks.length === 0) {
        addCheck('Datos extraídos', false, 'Faltan datos para validar el documento');
    }

    const passedCount = checks.filter((check) => check.passed).length;
    const status = failures.length > 0 ? 'rejected' : missing.length > 0 ? 'needs_review' : 'approved';
    const rejectionReason = failures.length > 0 ? failures.join('; ') : missing.join('; ');

    return {
        status,
        rejectionReason,
        validation: {
            source: RULES_VERSION,
            status,
            checkedAt: new Date().toISOString(),
            confidence: checks.length ? Number((passedCount / checks.length).toFixed(2)) : 0,
            matches: checks,
            summary: {
                passed: passedCount,
                failed: failures.length,
                missing: missing.length,
            },
        },
    };
};

const buildContext = async (document) => {
    const [driver, vehicle, cedulaDocument] = await Promise.all([
        User.findById(document.driver_id).select('name phone').lean(),
        Vehicle.findOne({ driver_id: document.driver_id, isActive: true })
            .select('brand model year license_plate')
            .lean(),
        Document.findOne({ driver_id: document.driver_id, type: 'cedula' })
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    return { driver, vehicle, cedulaDocument };
};

const applyValidation = (document, result) => {
    document.status = result.status;
    document.validation = result.validation;
    document.rejectionReason = result.rejectionReason;
    document.reviewedBy = null;
    document.reviewedAt = new Date();
    document.markModified('validation');
    return document;
};

const validateDocument = async (document, context) => {
    const validationContext = context || await buildContext(document);
    return applyValidation(document, evaluateDocument(document, validationContext));
};

const validatePendingDocuments = async ({ limit = 50 } = {}) => {
    const documents = await Document.find({ status: { $in: ['pending', 'processing'] } }).limit(limit);
    const results = [];

    for (const document of documents) {
        await validateDocument(document);
        await document.save();
        results.push({ id: document._id, status: document.status });
    }

    return {
        processed: results.length,
        approved: results.filter((result) => result.status === 'approved').length,
        rejected: results.filter((result) => result.status === 'rejected').length,
        needsReview: results.filter((result) => result.status === 'needs_review').length,
    };
};

module.exports = {
    evaluateDocument,
    validateDocument,
    validatePendingDocuments,
    buildContext,
};
