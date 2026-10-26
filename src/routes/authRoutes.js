const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validation');
// const { authLimiter } = require('../middleware/rateLimiter'); // Deshabilitado — habilitar en producción

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     description: Crea una nueva cuenta de usuario en el sistema. El usuario puede ser conductor, pasajero o administrador.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - email
 *               - phone
 *               - password
 *               - company
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 4
 *                 description: Nombre completo del usuario
 *                 example: Juan Pérez Rodríguez
 *               username:
 *                 type: string
 *                 minLength: 4
 *                 description: Nombre de usuario único (sin espacios)
 *                 example: juanperez
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico del usuario
 *                 example: juan.perez@intel.com
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9]{9}$'
 *                 description: Número telefónico de 9 dígitos
 *                 example: "88001234"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Contraseña (mín. 8 caracteres, debe incluir mayúsculas, minúsculas, números y caracteres especiales)
 *                 example: MiPassword@123
 *               company:
 *                 type: string
 *                 description: Nombre de la empresa donde labora
 *                 example: Intel Costa Rica
 *               work_schedule:
 *                 type: string
 *                 description: Horario de trabajo (opcional)
 *                 example: 7:00 AM - 4:00 PM
 *               type:
 *                 type: string
 *                 enum: [conductor, pasajero, administrador]
 *                 description: Tipo de usuario (por defecto es 'pasajero')
 *                 example: conductor
 *           examples:
 *             conductor:
 *               summary: Registro de conductor
 *               value:
 *                 name: Carlos Rodríguez
 *                 username: carlosdriver
 *                 email: carlos.rodriguez@intel.com
 *                 phone: "88001234"
 *                 password: Driver@2024
 *                 company: Intel Costa Rica
 *                 work_schedule: 7:00 AM - 4:00 PM
 *                 type: conductor
 *             pasajero:
 *               summary: Registro de pasajero
 *               value:
 *                 name: María González
 *                 username: mariagonzalez
 *                 email: maria.gonzalez@amazon.com
 *                 phone: "88005678"
 *                 password: Pass@2024
 *                 company: Amazon Costa Rica
 *                 type: pasajero
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                       description: Token JWT de acceso (válido por 24 horas)
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *                       description: Token JWT para refrescar el acceso (válido por 7 días)
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */

// Validation rules
const registerValidation = [
  body('name').trim().isLength({ min: 4 }).withMessage('Name must be at least 4 characters'),
  body('username').trim().isLength({ min: 4 }).withMessage('Username must be at least 4 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('phone').matches(/^\d{8}$/).withMessage('Phone must be 8 digits'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('company').notEmpty().withMessage('Company is required'),
  body('type').optional().isIn(['conductor', 'pasajero', 'admin']),
];

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Autentica un usuario existente y devuelve tokens de acceso
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Correo electrónico del usuario
 *                 example: juan.perez@intel.com
 *               password:
 *                 type: string
 *                 description: Contraseña del usuario
 *                 example: MiPassword@123
 *           example:
 *             email: juan.perez@intel.com
 *             password: MiPassword@123
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Invalid credentials
 */


/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refrescar token de acceso
 *     description: Genera un nuevo accessToken usando un refreshToken válido
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Token de refresco válido
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refrescado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token refreshed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Refresh token inválido o expirado
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refrescar token de acceso
 *     description: Genera un nuevo accessToken usando un refreshToken válido
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Token de refresco válido
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refrescado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token refreshed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Refresh token inválido o expirado
 */


/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Cierra la sesión del usuario actual e invalida el refresh token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */


/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener usuario actual
 *     description: Retorna la información del usuario autenticado actualmente
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */


/**
 * @swagger
 * /auth/password:
 *   put:
 *     summary: Cambiar contraseña
 *     description: Permite al usuario cambiar su contraseña actual
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Contraseña actual del usuario
 *                 example: OldPassword@123
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Nueva contraseña (debe cumplir requisitos de seguridad)
 *                 example: NewPassword@123
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password updated successfully
 *       401:
 *         description: Contraseña actual incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Current password is incorrect
 */

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

const passwordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
];

// Routes
router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.getMe);
router.post('/send-verification-code', authController.sendVerificationCode);
router.post('/verify-code', authController.verifyCode);
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Email válido requerido'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Código debe ser de 6 dígitos'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener mayúscula, minúscula, número y carácter especial'),
], validate, authController.resetPassword);
router.post('/push-token', verifyToken, authController.updatePushToken);
router.patch('/notification-preferences', verifyToken, authController.updateNotificationPreferences);
router.put('/password', verifyToken, passwordValidation, validate, authController.updatePassword);

module.exports = router;