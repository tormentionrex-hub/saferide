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

        
    } catch (error) {
        next(error);
    }
}