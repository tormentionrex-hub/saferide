const jwt = require('jsonwebtoken');
const { User } = require('../models');

const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h'}
    );

    const refreshToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return { accessToken, refreshToken };
};

// @desc Register a new user
// @route POST /api/v1/auth/register
// @access Public

exports.register = async (req, res, next) =>{
    try {
        const { name, username, email, phone, password, company, work_schedule, type}= req.body;
        // Check if the user already exists
        const existingUser = await User.findOne(
           { $or: [{email}, {username}]}
        );
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email or username already exists',
            });
        }

        // Create a new user
        const user = await User.create({
            name,
            username,
            email,
            phone,
            password,
            company,
            work_schedule,
            type: type || 'pasajero',

        });

        //Generate tokens
        const { accessToken, refreshToken} = generateTokens(user._id);

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: user.toPublicJSON(),
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Login User
// @route POST /api/v1/auth/login
// @access Public

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user and include password field
        const user = await User.findOne({ email}).select('+password');

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Generate tokens
        const { accessToken, refreshToken} = generateTokens(user._id);

        // Save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: user.toPublicJSON(),
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Refresh access token
// @route POST /api/v1/auth/refresh-token
// @access Public

exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken} = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required',
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        // Find user
        const user = await User.findById(decoded.userId).select('+refreshToken');

        if (!user || user.refreshToken !== refreshToken || user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token',
            });
        }

        // Generate new tokens
        const tokens = generateTokens(user._id);

        // Update refresh token
        user.refreshToken = tokens.refreshToken;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: tokens,
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
        });
    }
};

// @desc Logout user
// @route POST /api/v1/auth/logout
// @access Private

exports.logout = async (req, res, next) => {
    try {
        // Clear refresh token
        req.user.refreshToken = null;
        await req.user.save();

        res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    } catch (error) {
        next(error);
    }
};

// @desc Get current user
// @route GET /api/v1/auth/me
// @access Private

exports.getMe = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: req.user.toPublicJSON(),
        });
    } catch (error) {
        next(error);
    }
};

// @desc Update Password
// @route PUT /api/v1/auth/password
// @access Private

exports.updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await User.findById(req.user._id).select('+password');

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect',
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully',
        });
    } catch (error) {
        next(error);
    }
};
