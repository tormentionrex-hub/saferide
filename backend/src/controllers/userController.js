const passport = require("passport");
const { User, Vehicle, TrustHistory } = require("../models");
const { uploadToBlob, deleteFromBlob } = require("../services/blobService");
const trustService = require("../services/trustService");
const notificationService = require("../services/notificationService");
const { recordAudit } = require("../services/auditService");

// Motivos que impiden borrar una cuenta (la propia o, desde el panel, la de
// otro): viajes o reservas en curso y cobros pendientes. Devuelve null si se
// puede borrar o { code, message } con el primer bloqueo.
const OPEN_RIDE = ['scheduled', 'in progress', 'awaiting_payment_verification'];
const accountBlocker = async (userId) => {
    const { Ride, Booking } = require("../models");
    const openRide = await Ride.exists({ driver_id: userId, status: { $in: OPEN_RIDE } });
    const openBookings = await Booking.find({
        passenger_id: userId,
        status: { $in: ['pending', 'confirmed'] },
    }).populate('ride_id', 'status');
    const activeBooking = openBookings.some(b => b.ride_id && OPEN_RIDE.includes(b.ride_id.status));
    if (openRide || activeBooking) {
        return { code: 'ACTIVE_TRIPS', message: 'Cancel or finish your active trips before deleting your account' };
    }
    const unpaid = await Booking.exists({
        passenger_id: userId,
        status: 'completed',
        payment_status: 'pending',
        payment_type: { $ne: 'gifted' },
    });
    if (unpaid) {
        return { code: 'PENDING_PAYMENTS', message: 'Pay your pending charges before deleting your account' };
    }
    return null;
};

// Deja la cuenta sin datos personales e inutilizable (mismo criterio que el
// borrado de cuenta propio): el documento queda porque otros usuarios lo
// referencian en su historial de viajes, reservas y reseñas.
const anonymizeUser = async (user) => {
    const tag = user._id.toString();
    user.name = 'Usuario eliminado';
    user.username = `eliminado_${tag}`;
    user.email = `eliminado+${tag}@saferide.invalid`;
    if (user.phone) user.phone = '00000000';
    user.profileImage = null;
    user.password = require('crypto').randomBytes(32).toString('hex');
    user.refreshToken = null;
    user.expoPushToken = null;
    user.currentLocation = undefined;
    user.optIn = false;
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save({ validateBeforeSave: false });
};

// @desc Get all users (admin only)
// @route GET /api/v1/users
// @access Private/Admin

//Function to get all users
exports.getAllUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 9, type, company, search, initial } = req.query;
        // Build query object
        const query = {};
        // Add filters if provided
        if (type) query.type = type;
        if (company) query.company = company;
        if (initial) {
            query.name = { $regex: `^${initial}`, $options: "i" };
        }
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
            .sort({ createdAt: -1, _id: 1 });
        const count = await User.countDocuments(query);
        
        // Get global stats (ignoring pagination and search filters, just by type)
        const globalStats = {
            total: await User.countDocuments({ type: query.type || 'pasajero' }),
            active: await User.countDocuments({ type: query.type || 'pasajero', isActive: true })
        };

        // Respond with users and pagination info
        res.status(200).json({
            success: true,
            data: users,
            stats: globalStats,
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
        // El perfil completo (correo, teléfono, preferencias) solo lo ve el
        // propio usuario o un administrador; el resto ve la ficha pública.
        const isSelf = req.params.id === req.user._id.toString();
        const fields = isSelf || req.user.type === 'admin'
            ? '-password -refreshToken'
            : 'name username type company profileImage rating trustScore isActive createdAt';
        const user = await User.findById(req.params.id)
        .select(fields)
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

// @desc Get own profile (from token)
// @route GET /api/v1/users/profile
// @access Private
exports.getMyProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -refreshToken')
            .populate('vehicle');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// @desc Update own profile (from token)
// @route PUT /api/v1/users/profile
// @access Private
exports.updateMyProfile = async (req, res, next) => {
    try {
        const allowedUpdates = ['name', 'phone', 'company', 'work_schedule', 'profileImage'];
        const updates = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password -refreshToken');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, message: 'User updated successfully', data: user });
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

        if (req.user._id.toString() !== id && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        // Fields that can be updated

        const allowedUpdates = ['name', 'phone', 'company', 'work_schedule', 'profileImage'];
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

        if (req.user._id.toString() !== id && req.user.type !== 'admin') {
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

        // Solo se borra si el blob es de este usuario: profileImage es una URL
        // que el propio usuario puede escribir con PUT /users/profile, y
        // deleteFromBlob borra por nombre de archivo, así que apuntándola a la
        // foto de otro se borraba la foto ajena.
        if (user.profileImage
            && String(user.profileImage).split('/').pop().startsWith(`profile-${id}-`)) {
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
        await recordAudit(req, { action: 'USER_DEACTIVATED', targetType: 'User', targetId: user._id, details: `Cuenta ${user.type} desactivada` });
        
        res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc Delete own account (requisito de Google Play y App Store)
// @route DELETE /api/v1/users/me
// @access Private
//
// No se borra el documento: reservas, viajes y reseñas lo referencian y el
// historial de los demás usuarios no debe romperse. Se anonimizan los datos
// personales, se invalida la contraseña y las sesiones, y la cuenta queda
// inactiva. El correo se reemplaza para que no se pueda volver a iniciar
// sesión con él (el login admite cuentas inactivas por la regla de
// trustScore) y para que la persona pueda registrarse de nuevo si quiere.
exports.deleteMyAccount = async (req, res, next) => {
    try {
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const user = await User.findById(req.user._id).select('+password');
        if (!user || user.deletedAt) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (!(await user.comparePassword(password))) {
            // 403 y no 401: la app trata todo 401 como sesión vencida y cerraría la sesión.
            return res.status(403).json({ success: false, code: 'WRONG_PASSWORD', message: 'Incorrect password' });
        }

        const blocker = await accountBlocker(user._id);
        if (blocker) {
            return res.status(409).json({ success: false, ...blocker });
        }

        await anonymizeUser(user);

        await Vehicle.updateMany({ driver_id: user._id }, { $set: { isActive: false } });

        res.status(200).json({ success: true, message: 'Account deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc Borrado definitivo de un usuario (panel de admin)
// @route DELETE /api/v1/users/:id/hard
// @access Private/Admin
//
// Reglas: nunca sobre uno mismo ni sobre otro admin; bloqueado con viajes o
// reservas activas o cobros pendientes (mismas reglas que el borrado propio).
// Lo que es solo del usuario se borra en cascada (vehículos, documentos,
// notificaciones, historial de confianza, métricas, códigos y los viajes que
// publicó sin reservas de nadie). Si después todavía hay historial de otros
// que lo referencia (viajes con pasajeros, reservas en viajes ajenos,
// reseñas), el documento NO se borra: se anonimiza de forma irreversible,
// para no dejar a esos usuarios con referencias rotas. Si no queda nada que
// lo referencie, el documento se borra. La respuesta dice cuál fue (mode).
exports.hardDeleteUser = async (req, res, next) => {
    try {
        const { Ride, Booking, Review, Notification, Metrics, VerificationCode, VehicleDocument } = require("../models");
        const { id } = req.params;

        if (id === req.user._id.toString()) {
            return res.status(400).json({ success: false, code: 'SELF_DELETE', message: 'You cannot delete your own account from the panel' });
        }
        const user = await User.findById(id).select('+refreshToken');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.type === 'admin') {
            return res.status(403).json({ success: false, code: 'ADMIN_TARGET', message: 'Admin accounts cannot be deleted from the panel' });
        }
        const blocker = await accountBlocker(user._id);
        if (blocker) {
            return res.status(409).json({ success: false, ...blocker });
        }

        const email = user.email;
        await Promise.all([
            Vehicle.deleteMany({ driver_id: user._id }),
            VehicleDocument.deleteMany({ driver_id: user._id }),
            Notification.deleteMany({ user_id: user._id }),
            TrustHistory.deleteMany({ user_id: user._id }),
            Metrics.deleteMany({ user_id: user._id }),
            VerificationCode.deleteMany({ email }),
        ]);
        // Viajes propios sin ninguna reserva: no son historial de nadie más.
        const ownRides = await Ride.find({ driver_id: user._id }).select('_id').lean();
        const rideIds = ownRides.map(r => r._id);
        const ridesWithBookings = await Booking.distinct('ride_id', { ride_id: { $in: rideIds } });
        const withBookings = new Set(ridesWithBookings.map(String));
        await Ride.deleteMany({ _id: { $in: rideIds.filter(r => !withBookings.has(String(r))) } });

        const referenced = await Promise.all([
            Ride.exists({ driver_id: user._id }),
            Booking.exists({ passenger_id: user._id }),
            Review.exists({ $or: [{ reviewer_id: user._id }, { reviewee_id: user._id }] }),
        ]);
        let mode;
        if (referenced.some(Boolean)) {
            await anonymizeUser(user);
            mode = 'anonymized';
        } else {
            await User.deleteOne({ _id: user._id });
            mode = 'deleted';
        }

        await recordAudit(req, {
            action: 'USER_HARD_DELETED',
            targetType: 'User',
            targetId: user._id,
            details: `Cuenta ${user.type} eliminada definitivamente (${mode === 'deleted' ? 'borrada' : 'anonimizada: tiene historial con otros usuarios'})`,
        });

        res.status(200).json({ success: true, message: 'User permanently deleted', data: { mode } });
    } catch (error) {
        next(error);
    }
};

// @desc Activate user
// @route PATCH /api/v1/users/:id/activate
// @access Private/Admin
exports.activateUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        user.isActive = true;
        await user.save();
        await recordAudit(req, { action: 'USER_ACTIVATED', targetType: 'User', targetId: user._id, details: `Cuenta ${user.type} activada` });

        res.status(200).json({
            success: true,
            message: 'User activated successfully',
            data: user
        });
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

// @desc   Update a user's trustScore (admin only)
// @route  PATCH /api/v1/users/:id/trust
// @access Private/Admin
// Body: { action: 'increment' | 'decrement' | 'reset' }
exports.updateTrust = async (req, res, next) => {
    try {
        const { action } = req.body || {};
        if (!['increment', 'decrement', 'reset'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action. Must be 'increment', 'decrement' or 'reset'.",
            });
        }

        const targetUser = await User.findById(req.params.id).select('_id type');
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        const opts = { actorId: req.user._id };
        let result;
        if (action === 'reset') {
            result = await trustService.resetTrust(req.params.id, opts);
        } else if (action === 'decrement') {
            result = await trustService.decrementTrust(req.params.id, {
                ...opts,
                reason: 'admin_decrement',
            });
        } else {
            result = await trustService.incrementTrust(req.params.id, opts);
        }

        if (result.changed) {
            await recordAudit(req, {
                action: 'USER_TRUST_CHANGED',
                targetType: 'User',
                targetId: targetUser._id,
                details: `Trust score ${result.previousScore} -> ${result.newScore} (${action})`,
            });
        }

        // Notificación fire-and-forget al usuario afectado. Solo se dispara
        // cuando hubo cambio real. Si el push falla, solo se loguea y la
        // respuesta al admin no se ve afectada.
        if (result.changed) {
            let msg = null;
            if (action === 'reset' && result.user?.isActive) {
                msg = `Tu cuenta fue reactivada por un administrador. Tu trust score volvió a ${result.newScore}.`;
            } else if (action === 'increment' && result.user?.isActive) {
                msg = `Un administrador aumentó tu trust score a ${result.newScore}.${
                    result.previousScore === 0 ? ' Tu cuenta ha sido reactivada.' : ''
                }`;
            } else if (action === 'decrement') {
                msg = result.newScore === 0
                    ? `Un administrador bajó tu trust score a 0. Tu cuenta ha sido limitada: no podrás publicar nuevos viajes hasta que un administrador la reactive.`
                    : `Un administrador bajó tu trust score a ${result.newScore} de 4.`;
            }
            if (msg) {
                notificationService
                    .sendNotification(req.params.id, msg, 'trust_score_updated')
                    .catch((err) => console.error('[Trust] notify error:', err.message));
            }
        }

        return res.status(200).json({
            success: true,
            message: result.changed
                ? `Trust score updated (${result.previousScore} → ${result.newScore})`
                : `No change (trustScore already at ${result.newScore})`,
            data: result.user,
            trust: {
                previousScore: result.previousScore,
                newScore: result.newScore,
                changed: result.changed,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc   Get TrustHistory for a specific user (admin only)
// @route  GET /api/v1/users/:id/trust/history
// @access Private/Admin
exports.getTrustHistory = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const [entries, total] = await Promise.all([
            TrustHistory.find({ user_id: req.params.id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('actor_id', 'name email type')
                .lean(),
            TrustHistory.countDocuments({ user_id: req.params.id }),
        ]);

        return res.status(200).json({
            success: true,
            data: entries,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc   Get TrustHistory for the authenticated user
// @route  GET /api/v1/users/me/trust/history
// @access Private (any authenticated user, sees only their own)
exports.getMyTrustHistory = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const userId = req.user._id;

        const [entries, total] = await Promise.all([
            TrustHistory.find({ user_id: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                // No populamos actor_id aquí: el usuario no necesita saber
                // qué admin específico ajustó su score, solo el motivo.
                .lean(),
            TrustHistory.countDocuments({ user_id: userId }),
        ]);

        return res.status(200).json({
            success: true,
            data: entries,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};