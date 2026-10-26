const { Vehicle, User } = require("../models");
const { uploadToBlob, deleteFromBlob } = require("../services/blobService");

// @desc Create a Vehicle
// @route POST /api/v1/vehicles
// @access Private

//Function to create a vehicle
exports.createVehicle = async (req, res, next) => {
    try {
        const { brand, model, license_plate, color, year, capacity } = req.body;
        const { driver_id } = req.body;
        const targetDriverId = req.user.type === 'admin' && driver_id ? driver_id : req.user._id;

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
            license_plate: license_plate.toUpperCase(),
            capacity,
            color,
            year,
        });

        res.status(201).json({
            success: true,
            message: 'Vehicle created successfully',
            data: vehicle,
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
        const vehicle = await Vehicle.findById(req.params.id)
        .populate('driver_id', 'name username email phone rating');
        // Validate vehicle existence
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
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

        // Delete old image if exists
        if (vehicle.vehicleImage) {
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
        if (vehicle.driver_id.toString() !== req.user.id.toString() &&
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
        const query = {};

        // Filtro por estado: pendings (isActive: false) o active (isActive: true)
        if (status === 'active') query.isActive = true;
        if (status === 'pending') query.isActive = false;

        // Búsqueda por placa o marca
        if (search) {
            query.$or = [
                { license_plate: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }

        const vehicles = await Vehicle.find(query)
            .populate('driver_id', 'name username email phone profileImage')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1, _id: 1 });

        const count = await Vehicle.countDocuments(query);

        res.status(200).json({
            success: true,
            data: vehicles,
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

        vehicle.isActive = isActive;
        await vehicle.save();

        res.status(200).json({
            success: true,
            message: `Vehicle ${isActive ? 'approved' : 'deactivated'} successfully`,
            data: vehicle,
        });
    } catch (error) {
        next(error);
    }
};


