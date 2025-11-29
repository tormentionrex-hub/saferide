const passport = require("passport");
const { User, Vehicle } = require("../models");
const { uploadToBlob, deleteFromBlob } = require("../services/blobService");

// @desc Get all users (admin only)
// @route GET /api/v1/users
// @access Private/Admin

//Function to get all users
exports.getAllUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type, company, search } = req.query;
        // Build query object
        const query = {};
        // Add filters if provided
        if (type) query.type = type;
        if (company) query.company = company;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        // Fetch users with pagination
        const users = await User.find(query)
            .select("-password -refreshToken")
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
        const count = await User.countDocuments(query);
        // Respond with users and pagination info
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

//Function to get user by ID
exports.getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
        .select('-password -refreshToken')
        .populate('vehicle');

// Validate user existence
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    // Respond with user data
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

//Function to update user profile
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
        // Build updates object
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined){
                updates[field] = req.body[field];
            }
        });
        // Update user
        const user = await User.findByIdAndUpdate(
            id, 
            updates,
            { new: true, runValidators: true})
            .select('-password -refreshToken');
        // Validate user existence
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        // Respond with updated user data
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

//Function to upload profile image
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
        // Validate file presence
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }
        // Find user
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
        // Update user's profile image URL
        user.profileImage = imageUrl;
        await user.save();
        // Respond with success
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

//Function to delete user
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
        // Respond with success
        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
        });

        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
        });
                // Hard delete (uncomment if needed)
        /*
        await user.deleteOne();
        */
    } catch (error) {
        next(error);
    }
};

// @desc Get user statistics
// @route GET /api/v1/users/:id/stats
// @access Private

//Function to get user statistics
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
    // Respond with statistics
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