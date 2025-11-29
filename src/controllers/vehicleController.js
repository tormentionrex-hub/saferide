const { Vehicle, User } = require("../models");
const { uploadToBlob, deleteFromBlob } = require("../services/blobService");

// @desc Create a Vehicle
// @route POST /api/v1/vehicles
// @access Private

//Function to create a vehicle
exports.createVehicle = async (req, res, next) => {
    try {
        const { brand, model, license_plate, color, year } = req.body;

        // Check if user is conductor
        if (req.user.type !== 'conductor') {
            return res.status(403).json({
                success: false,
                message: 'Only drivers can create vehicles',
            });
        }

        // Check if user already has a vehicle
        const existingVehicle = await Vehicle.findOne({
            driver_id: req.user._id
        });

        if (existingVehicle) {
            return res.status(409).json({
                success: false,
                message: 'User already has a registered vehicle',
            });
        }

        // Create new vehicle
        const vehicle = await Vehicle.create({
            driver_id: req.user._id,
            brand,
            model,
            license_plate: license_plate.toUpperCase(),
            capacity, // TODO: Validate why is not populating on the database (error capacity is not defined)
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
            driver_id: req.params.driverId
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

        // Check if user owns the vehicle
        if (vehicle.driver_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied',
            });
        }

        // Fields that can be updated
        const allowedUpdates = ['brand', 'model', 'color', 'year'];
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

        // Check if user owns the vehicle
        if (vehicle.driver_id.toString() !== req.user._id.toString()) {
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
    req.user.type !== 'administrador') {
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


