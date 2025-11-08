const passport = require("passport");
const { User, Vehicle } = require("../models");
const { uploadToBlob, deleteFromBlob } = require("../services/blobService");

// @desc Get all users (admin only)
// @route GET /api/v1/users
// @access Private/Admin

exports.getAllUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type, company, search } = req.query;

        const query = {};

        if (type) query.type = type;
        if (company) query.company = company;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const users = await User.find(query)
            .select("-password -refreshToken")
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .toSorted({ createdAt: -1 });
        const count = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users,
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

// @desc Get user by ID
// @route GET /api/v1/users/:id
// @access Private

exports.getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
        .select('-password -refreshToken')
        .populate('vehicle');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc Update user profile
// @route PUT /api/v1/users/:id
// @access Private

exports.updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        //Check if the user is updating their own profile or is an admin

        if (req.user._id.toString() !== id && req.user.type !== 'administrador') {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        // Fields that can be updated

        const allowedUpdates = ['name', 'phone', 'company', 'work_schedule'];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined){
                updates[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            id, 
            updates,
            { new: true, runValidators: true})
            .select('-password -refreshToken');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc Updload profile image
// @route POST /api/v1/users/:id/image
// @access Private

exports.uploadProfileImage = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if the user is updatin their own profile

        if (req.user._id.toString() !== id && req.user.type !== 'administrador') {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Delete old image if exists

        if (user.profileImage) {
            await deleteFromBlob(user.profileImage, 'profile-images');
        }

        // Upload new image

        const imageUrl = await uploadToBlob(
            req.file.buffer,
            `profile-${id}-${Date.now()}.jpg`,
            'profile-images',
            req.file.mimetype
        );

        user.profileImage = imageUrl;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile image uploaded successfully',
            data: { imageUrl },
        });
                
    } catch (error) {
        next(error);
    }
};

// @desc Delete user
// @route DELETE /api/v1/users/:id
// @access Private/Admin

exports.deleteUser = async ( req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Soft delete: set active to false
        user.isActive = false;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
        });

        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get user statistics
// @route GET /api/v1/users/:id/stats
// @access Private

exports.getUserStats = async (req, res, next) => {
    try {
        const { Ride, Booking, Review, Metrics } = require("../models");
        const userId = req.params.id;

        // Get rides as driver
        const ridesAsDriver = await Ride.countDocuments({
            driver_id: userId,
            status: 'completed',
        });

        // Get rides as passenger
        const ridesAsPassenger = await Booking.countDocuments({
            passenger_id: userId,
            status: 'completed',
        });

        // Get average rating
        const reviews = await Review.find({
            reviewee_id: userId,
        });
        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0)/ reviews.length
            :0;

        // Get Metrics
        const metrics = await Metrics.findOne({
            user_id: userId,
            period: 'total',
        });

        res.status(200).json({
            success: true,
            data: {
                ridesAsDriver,
                ridesAsPassenger,
                totalRides: ridesAsDriver + ridesAsPassenger,
                averageRating: avgRating.toFixed(2),
                kilometersShared: metrics?.kilometers_driven || 0,
                carbonSaved: metrics?.carbon_footprint || 0,
            },
        });
    } catch (error) {
        next(error);
    }
};