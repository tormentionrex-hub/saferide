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
