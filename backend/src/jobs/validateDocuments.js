const logger = require('../utils/logger');
const { checkConnection, connectDB } = require('../config/database');
const documentValidationService = require('../services/documentValidationService');
const { syncAllVehicleApprovals } = require('../services/vehicleApprovalService');

const validateDocumentsJob = async () => {
    if (!checkConnection()) await connectDB();
    const result = await documentValidationService.validatePendingDocuments({ limit: 50 });
    const vehicles = await syncAllVehicleApprovals();
    logger.info(
        `🧾 Validación de documentos: ${result.processed} procesados, ` +
        `${result.approved} aprobados, ${result.rejected} rechazados, ${result.needsReview} en revisión`
    );
    logger.info(
        `🚗 Estado de flota: ${vehicles.drivers} conductores, ${vehicles.activated} activos, ${vehicles.changed} cambios`
    );
    return { ...result, vehicles };
};

module.exports = validateDocumentsJob;
