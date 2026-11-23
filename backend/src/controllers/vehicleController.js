const mongoose = require('mongoose');
const { Vehicle, Ride, Booking } = require('../models');
const { uploadToBlob, deleteFromBlob } = require('../services/blobService');
const { getDocumentApproval, syncVehicleApproval } = require('../services/vehicleApprovalService');
const { recordAudit } = require('../services/auditService');

const PLATE_REGEX = /^(?=.*[0-9])[A-Z0-9]{6}$/;
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];
const ACTIVE_RIDE_STATUSES = ['scheduled', 'in progress', 'awaiting_payment_verification'];

const normalizePlate = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);

const idsMatch = (a, b) => {
    if (!a || !b) return false;
    return a.toString() === b.toString();
};

const canAccessDriverVehicle = async (req, driverId) => {
    if (!req.user || !driverId || !mongoose.Types.ObjectId.isValid(String(driverId))) return false;
    if (req.user.type === 'admin' || idsMatch(req.user._id, driverId)) return true;
    // En SafeRide el tipo del pasajero es 'pasajero' (con 'passenger' nunca
    // coincidía y el pasajero con reserva activa no veía el vehículo).
    if (req.user.type !== 'pasajero') return false;

    const rideIds = await Booking.find({
        passenger_id: req.user._id,
        status: { $in: ACTIVE_BOOKING_STATUSES },
    }).distinct('ride_id');

    if (rideIds.length === 0) return false;

    return Boolean(await Ride.exists({
        _id: { $in: rideIds },
        driver_id: driverId,
        status: { $in: ACTIVE_RIDE_STATUSES },
    }));
};

// @desc Create a Vehicle
// @route POST /api/v1/vehicles
// @access Private

//Function to create a vehicle
exports.createVehicle = async (req, res, next) => {
    try {
        const { brand, model, license_plate, color, year, capacity } = req.body;
        const { driver_id } = req.body;
        const targetDriverId = req.user.type === 'admin' && driver_id ? driver_id : req.user._id;
        const plate = normalizePlate(license_plate);

        if (!PLATE_REGEX.test(plate)) {
            return res.status(400).json({
                success: false,
                message: 'La placa debe tener 6 caracteres alfanuméricos e incluir al menos un número',
            });
        }

        // Segunda barrera (la ruta ya lo valida): la placa debe ser texto.
        if (typeof license_plate !== 'string') {
            return res.status(400).json({ success: false, message: 'License plate must be 6 characters' });
        }

        // Desactivar TODOS los vehículos activos previos del driver.
        // En condiciones normales habrá 0 o 1, pero defensivamente cubrimos
        // el caso de >1 activo (data legacy o race condition) para que el
        // INSERT siguiente no choque con el partial unique index.
        await Vehicle.updateMany(
            { driver_id: targetDriverId, isActive: true },
            { $set: { isActive: false } }
        );

        const vehicle = await Vehicle.create({
            driver_id: targetDriverId,
            brand,
            model,
            license_plate: plate,
            capacity,
            color,
            year,
            isActive: false,
        });

        // Certificado de la póliza que la app sube a Cloudinary al registrar
        // el vehículo: queda como documento 'poliza' pendiente de revisión.
        // Si falla, el vehículo ya quedó creado; solo se registra el error.
        try {
            await require('./documentController').createRegistrationDocument(vehicle, req.body);
        } catch (docErr) {
            console.error('[Vehicle] no se pudo guardar el certificado de la póliza:', docErr.message);
        }

        await syncVehicleApproval(targetDriverId, vehicle._id);
        const updatedVehicle = await Vehicle.findById(vehicle._id);

        res.status(201).json({
            success: true,
            message: 'Vehicle created successfully',
            data: updatedVehicle,
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get Vehicle by Driver ID
// @route GET /api/v1/vehicles/driver/:driverId
// @access Private

//Function to get vehicle by driver ID
exports.getVehicleByDriver = async (req, res, next) => {
    try {
        if (!await canAccessDriverVehicle(req, req.params.driverId)) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }

        const vehicle = await Vehicle.findOne({
            driver_id: req.params.driverId,
            isActive: true,
        });

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        // Respond with vehicle data
        res.status(200).json({
            success: true,
            data: vehicle,
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get vehicle by ID
// @route GET /api/v1/vehicles/:id
// @access Private

// Note: route expects `getVehicleById` (capital B). Keep this name to match route files.
exports.getVehicleById = async (req, res, next) => {
    try {
        // Correo y teléfono del conductor solo para él mismo o un admin (el
        // panel). Cualquier usuario con sesión podía sacarlos recorriendo
        // /vehicles/driver/:id → /vehicles/:id.
        const vehicle = await Vehicle.findById(req.params.id);
        const canSeeContact = req.user.type === 'admin'
            || (vehicle && vehicle.driver_id?.toString() === req.user._id.toString());
        if (vehicle) {
            await vehicle.populate('driver_id', canSeeContact
                ? 'name username email phone rating'
                : 'name username rating');
        }
        // Validate vehicle existence
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        const driverId = vehicle.driver_id?._id || vehicle.driver_id;
        if (!await canAccessDriverVehicle(req, driverId)) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }

        res.status(200).json({
            success: true,
            data: vehicle,
        });
    } catch (error) {
        next(error);
    }
};

// @desc Update vehicle
// @route PUT /api/v1/vehicles/:id
// @access Private/Conductor

//Function to update vehicle
exports.updateVehicle = async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        // Validate vehicle existence
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        // Check if user owns the vehicle or is admin
        if (vehicle.driver_id.toString() !== req.user._id.toString() && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }

        // Fields that can be updated
        const allowedUpdates = ['brand', 'model', 'color', 'year', 'capacity', 'license_plate'];
        const updates = {};
        // Build updates object
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (updates.license_plate !== undefined) {
            updates.license_plate = normalizePlate(updates.license_plate);
            if (!PLATE_REGEX.test(updates.license_plate)) {
                return res.status(400).json({
                    success: false,
                    message: 'La placa debe tener 6 caracteres alfanuméricos e incluir al menos un número',
                });
            }
        }

        Object.assign(vehicle, updates);
        await vehicle.save();

        res.status(200).json({
            success: true,
            message: 'Vehicle updated successfully',
            data: vehicle,
        });
    } catch (error) {
        next(error);
    }
};

// @desc Upload vehicle image
// @route POST /api/v1/vehicles/:id/image
// @access Private/Conductor

//Function to upload vehicle image
exports.uploadVehicleImage = async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

// Validate vehicle existence
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        // Check if user owns the vehicle or is admin
        if (vehicle.driver_id.toString() !== req.user._id.toString() && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }

        // Sin archivo, 400 (antes reventaba con 500 al leer req.file.buffer).
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }

        // Delete old image if exists (solo si es un blob de este vehículo).
        if (vehicle.vehicleImage
            && String(vehicle.vehicleImage).split('/').pop().startsWith(`vehicle-${vehicle._id}-`)) {
            await deleteFromBlob(vehicle.vehicleImage, 'vehicle-images');
        }

        // Upload new image
        const imageUrl = await uploadToBlob(req.file.buffer, 
            `vehicle-${vehicle._id}-${Date.now()}.jpg`,
            'vehicle-images',
            req.file.mimetype
        );
        // Update vehicle with new image URL
        vehicle.vehicleImage = imageUrl;
        await vehicle.save();

        res.status(200).json({
            success: true,
            message: 'Vehicle image uploaded successfully',
            data: { imageUrl },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Delete vehicle
// @route DELETE /api/v1/vehicles/:id
// @access Private/Conductor

//Function to delete vehicle
exports.deleteVehicle = async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

// Validate vehicle existence
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        // Check if user owns the vehicle or is admin
        if (vehicle.driver_id.toString() !== req.user._id.toString() &&
    req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }
        // Delete vehicle image if exists
        if (vehicle.vehicleImage) {
            await deleteFromBlob(vehicle.vehicleImage, 'vehicle-images');
        }

        await vehicle.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Vehicle deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get all vehicles (admin only)
// @route GET /api/v1/vehicles
// @access Private/Admin
exports.getAllVehicles = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const baseQuery = {};

        // Búsqueda por placa o marca
        if (search) {
            baseQuery.$or = [
                { license_plate: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        const query = { ...baseQuery };

        // Filtro por estado: pendings (isActive: false) o active (isActive: true)
        if (status === 'active') query.isActive = true;
        if (status === 'pending') query.isActive = false;

        const [vehicles, count, total, active, pending] = await Promise.all([
            Vehicle.find(query)
                .populate('driver_id', 'name username email phone profileImage')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1, _id: 1 }),
            Vehicle.countDocuments(query),
            Vehicle.countDocuments(baseQuery),
            Vehicle.countDocuments({ ...baseQuery, isActive: true }),
            Vehicle.countDocuments({ ...baseQuery, isActive: false }),
        ]);

        res.status(200).json({
            success: true,
            data: vehicles,
            stats: { total, active, pending },
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Approve or Deactivate vehicle
// @route PATCH /api/v1/vehicles/:id/status
// @access Private/Admin
exports.updateVehicleStatus = async (req, res, next) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean (true or false)',
            });
        }

        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        const isOwner = vehicle.driver_id.toString() === req.user._id.toString();
        const isAdmin = req.user.type === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }

        if (!isAdmin && isActive === true) {
            return res.status(403).json({
                success: false,
                message: 'Only admins can reactivate vehicles',
            });
        }

        if (isActive) {
            const approval = await getDocumentApproval(vehicle.driver_id);
            if (!approval.approved) {
                return res.status(409).json({
                    success: false,
                    message: 'No se puede activar el vehículo hasta que los 6 documentos estén aprobados',
                    pending: approval.pending,
                });
            }

            await syncVehicleApproval(vehicle.driver_id, vehicle._id);
            const updatedVehicle = await Vehicle.findById(vehicle._id);
            await recordAudit(req, {
                action: 'VEHICLE_APPROVED',
                targetType: 'Vehicle',
                targetId: vehicle._id,
                details: `Vehículo placa ${vehicle.license_plate} aprobado`,
            });
            return res.status(200).json({
                success: true,
                message: 'Vehicle approved successfully',
                data: updatedVehicle,
            });
        }

        vehicle.isActive = false;
        await vehicle.save();
        if (isAdmin) {
            await recordAudit(req, {
                action: isActive ? 'VEHICLE_APPROVED' : 'VEHICLE_REJECTED',
                targetType: 'Vehicle',
                targetId: vehicle._id,
                details: `Vehículo placa ${vehicle.license_plate} ${isActive ? 'aprobado' : 'desactivado'}`,
            });
        }

        res.status(200).json({
            success: true,
            message: 'Vehicle deactivated successfully',
            data: vehicle,
        });
    } catch (error) {
        next(error);
    }
};



// @desc   Estado del vehículo del conductor y de sus 6 documentos
// @route  GET /api/v1/vehicles/me/approval
// @access Private (conductor)
//
// GET /vehicles/driver/:id solo devuelve el vehículo activo; un conductor
// nuevo tiene su vehículo inactivo hasta aprobar los documentos, así que la
// app usa esta ruta para saber que ya lo registró y qué le falta.
exports.getMyVehicleApproval = async (req, res, next) => {
    try {
        const { Document } = require('../models');
        const vehicle = await Vehicle.findOne({ driver_id: req.user._id })
            .sort({ isActive: -1, createdAt: -1, _id: -1 })
            .select('_id brand model year color license_plate capacity isActive createdAt');
        const approval = await getDocumentApproval(req.user._id);
        const ids = approval.details.map((d) => d.documentId).filter(Boolean);
        const docs = await Document.find({ _id: { $in: ids } })
            .select('_id type status rejectionReason extractedData createdAt')
            .lean();
        const byId = new Map(docs.map((d) => [String(d._id), d]));
        res.status(200).json({
            success: true,
            data: {
                vehicle,
                approved: approval.approved,
                details: approval.details.map((d) => {
                    const doc = d.documentId ? byId.get(String(d.documentId)) : null;
                    return {
                        type: d.type,
                        label: d.label,
                        status: d.status,
                        statusLabel: d.statusLabel,
                        approved: d.approved,
                        documentId: d.documentId,
                        rejectionReason: doc?.rejectionReason || '',
                        extractedData: doc?.extractedData || {},
                        updatedAt: doc?.createdAt || null,
                    };
                }),
            },
        });
    } catch (error) {
        next(error);
    }
};
