const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User, VerificationCode } = require('../models');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
// Solo se guarda el hash del refresh token: si alguien lee la base, no
// obtiene un token que le permita abrir sesión.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Helper function to generate access and refresh tokens.
// typ distingue ambos tokens: comparten secreto, y sin esta marca un refresh
// token (7 días) se aceptaba también como access token.
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId, typ: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h'}
    );

    // jti aleatorio: dos refresh firmados en el mismo segundo salían
    // idénticos y la rotación no podía invalidar el anterior.
    const refreshToken = jwt.sign(
        { userId, typ: 'refresh', jti: crypto.randomUUID() },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return { accessToken, refreshToken };
};

// @desc Register a new user
// @route POST /api/v1/auth/register
// @access Public

// Function to register a new user
exports.register = async (req, res, next) =>{
    try {
        const { name, username, email, phone, password, company, work_schedule, type}= req.body;
        // Check if the user already exists
        const existingUser = await User.findOne(
           { $or: [{ email: email.toLowerCase().trim() }, {username}]}
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
            // El registro público nunca crea administradores (esos salen del seed).
            type: type === 'conductor' ? 'conductor' : 'pasajero',

        });

        //Generate tokens
        const { accessToken, refreshToken} = generateTokens(user._id);

        // Save refresh token
        user.refreshToken = hashToken(refreshToken);
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

//Function to login a user
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user and include password field
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

        // Permitimos login a usuarios con isActive=false (cuenta limitada por
        // trustScore=0). El frontend recibe el flag isActive en la respuesta
        // y muestra un banner de cuenta limitada, pero la sesión es válida
        // para lecturas y para completar viajes existentes. Solo se rechaza
        // si las credenciales no son válidas.
        if (!user) {
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
        user.refreshToken = hashToken(refreshToken);
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

//Function to refresh access token
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required',
            });
        }

        // 1. Verificar firma y expiración del refresh token. Si falla,
        //    cae al catch y devolvemos 401.
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        if (decoded.typ === 'access') {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        // 2. Generar el nuevo par de tokens antes del update.
        const tokens = generateTokens(decoded.userId);

        // 3. Validar y rotar en una sola operación atómica.
        //    - El filtro exige que el refreshToken guardado en DB coincida
        //      exactamente con el que llegó por body. Si otro refresh ya rotó
        //      el token (o el usuario hizo logout, dejándolo en null), este
        //      findOneAndUpdate no encuentra documento y devolvemos 401.
        //    - Esto cierra dos problemas del enfoque anterior (find + save):
        //        a) save() con campos `select: false` no persistía la
        //           rotación (raíz del bug de seguridad).
        //        b) Race entre dos refresh paralelos: ambos podían validar
        //           y luego sobreescribirse entre sí; con findOneAndUpdate
        //           solo el primero gana, el segundo recibe null → 401.
        //    Se acepta también el token en claro para no cerrar las sesiones
        //    abiertas antes de guardar hashes; al rotar queda solo el hash.
        const updated = await User.findOneAndUpdate(
            { _id: decoded.userId, refreshToken: { $in: [hashToken(refreshToken), refreshToken] } },
            { refreshToken: hashToken(tokens.refreshToken) },
            { new: true }
        );

        if (!updated) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token',
            });
        }

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

//Function to logout a user
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

//Function to get current user
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

//Function to update user password
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
// @desc Send verification code to email
// @route POST /api/v1/auth/send-verification-code
// @access Public
exports.sendVerificationCode = async (req, res, next) => {
    try {
        const { email } = req.body;

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to database (delete existing codes for this email first)
        await VerificationCode.deleteMany({ email });
        await VerificationCode.create({ email, code });

        // --- BYPASS DE ENVÍO EN DESARROLLO O CORREOS DE PRUEBA ---
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEV MODE] Correo simulado a ${email}. Código real generado: ${code} (o puedes usar el código maestro 000000)`);
        } else {
            const mailOptions = {
                from: `"SafeRide" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Tu código de verificación de SafeRide',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #4CAF50;">Código de Verificación</h2>
                        <p>Gracias por unirte a SafeRide. Para completar tu registro, utiliza el siguiente código:</p>
                        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
                            ${code}
                        </div>
                        <p>Este código expirará en 10 minutos.</p>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
        }

        res.status(200).json({
            success: true,
            message: 'Verification code sent to email',
        });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending verification code. Check server configuration.',
        });
    }
};

// @desc Reset password using verification code
// @route POST /api/v1/auth/reset-password
// @access Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email, código y nueva contraseña son requeridos.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Backdoor para desarrollo/pruebas
        if (process.env.NODE_ENV === 'development' && code === '000000') {
            const user = await User.findOne({ email: normalizedEmail });
            if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
            user.password = newPassword;
            await user.save();
            return res.status(200).json({ success: true, message: 'Contraseña restablecida exitosamente.' });
        }

        const verification = await VerificationCode.findOne({ email: normalizedEmail, code });
        if (!verification) {
            return res.status(400).json({ success: false, message: 'Código inválido o expirado.' });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        user.password = newPassword;
        await user.save();

        await VerificationCode.deleteOne({ _id: verification._id });

        res.status(200).json({ success: true, message: 'Contraseña restablecida exitosamente.' });
    } catch (error) {
        next(error);
    }
};

// @desc Update Expo push token
// @route POST /api/v1/auth/push-token
// @access Private
exports.updatePushToken = async (req, res, next) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) return res.status(400).json({ success: false, message: 'pushToken es requerido.' });
        await User.findByIdAndUpdate(req.user._id, { expoPushToken: pushToken });
        res.status(200).json({ success: true, message: 'Push token actualizado.' });
    } catch (error) {
        next(error);
    }
};

// @desc Update notification preferences (opt-in para push del SO)
// @route PATCH /api/v1/auth/notification-preferences
// @access Private
//
// Si optIn=false el backend SEGUIRÁ guardando notificaciones en BD (para
// que el usuario las vea dentro de la campana), pero NO disparará el push
// del sistema operativo. El expoPushToken se mantiene intacto para que
// reactivar el switch no obligue al usuario a aceptar permisos del SO de
// nuevo.
exports.updateNotificationPreferences = async (req, res, next) => {
    try {
        const { optIn } = req.body;
        if (typeof optIn !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'optIn debe ser boolean (true | false).',
            });
        }
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { optIn },
            { new: true }
        );
        res.status(200).json({
            success: true,
            message: 'Preferencias de notificación actualizadas.',
            data: { optIn: user.optIn },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Verify the codeSent to email
// @route POST /api/v1/auth/verify-code
// @access Public
exports.verifyCode = async (req, res, next) => {
    try {
        const { email, code } = req.body;

        // --- BACKDOOR DE DESARROLLO PARA PRUEBAS (CÓDIGO MAESTRO) ---
        if ((process.env.NODE_ENV === 'development') && code === '000000') {
            return res.status(200).json({
                success: true,
                message: 'Código maestro verificado exitosamente (modo desarrollo).',
            });
        }

        const verification = await VerificationCode.findOne({ email, code });

        if (!verification) {
            return res.status(400).json({
                success: false,
                message: 'Código inválido o expirado.',
            });
        }

        // Delete the code after successful verification (one-time use)
        await VerificationCode.deleteOne({ _id: verification._id });

        res.status(200).json({
            success: true,
            message: 'Código verificado exitosamente.',
        });
    } catch (error) {
        next(error);
    }
};
