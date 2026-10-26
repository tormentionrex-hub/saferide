const express = require('express');
const multer = require('multer');
const userController = require('../controllers/userController');
const { verifyToken, authorize } = require('../middleware/auth');
const { COMPANIES } = require('../config/companies');

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * @swagger
 * /users/companies:
 *   get:
 *     summary: Empresas con convenio (público, lo usa el registro)
 *     tags: [Users]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de nombres de empresa
 */
// Público y antes de verifyToken: el registro lo consulta sin sesión.
router.get('/companies', (req, res) => {
  res.status(200).json({ success: true, data: COMPANIES });
});

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Obtener todos los usuarios
 *     description: Retorna una lista paginada de todos los usuarios (requiere rol de administrador)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', authorize('admin'), userController.getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     description: Retorna los detalles de un usuario específico
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detalles del usuario
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Must be before /:id so "profile" isn't treated as an ID
router.get('/profile', userController.getMyProfile);
router.put('/profile', userController.updateMyProfile);

/**
 * @swagger
 * /users/me/trust/history:
 *   get:
 *     summary: Obtener historial de trust score propio
 *     description: Retorna el historial paginado de cambios de trust score del usuario autenticado. Cualquier usuario autenticado puede ver únicamente su propio historial.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Historial de trust score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       user_id:
 *                         type: string
 *                       previous_score:
 *                         type: integer
 *                       new_score:
 *                         type: integer
 *                       delta:
 *                         type: integer
 *                       reason:
 *                         type: string
 *                         enum: [cancel_gifted_trip_passenger, cancel_in_progress_ride_driver, admin_increment, admin_reset]
 *                       actor_id:
 *                         type: string
 *                       booking_id:
 *                         type: string
 *                         nullable: true
 *                       ride_id:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Trust history del usuario autenticado (sees only their own).
// Debe ir antes de /:id para que "me" no sea interpretado como ID.
router.get('/me/trust/history', userController.getMyTrustHistory);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Eliminar la propia cuenta (anonimiza los datos)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password: { type: string }
 *     responses:
 *       200: { description: Cuenta eliminada }
 *       403: { description: Contraseña incorrecta }
 *       409: { description: Tiene viajes activos o cobros pendientes }
 */
router.delete('/me', userController.deleteMyAccount);

router.get('/:id', userController.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Actualizar usuario
 *     description: Actualiza los datos de un usuario existente
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *               work_schedule:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', userController.updateUser);

/**
 * @swagger
 * /users/{id}/image:
 *   post:
 *     summary: Subir imagen de perfil
 *     description: Sube una nueva imagen de perfil para el usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imagen actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         imageUrl:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/:id/image', upload.single('image'), userController.uploadProfileImage);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Eliminar usuario
 *     description: Elimina un usuario del sistema (requiere rol de administrador)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', authorize('admin'), userController.deleteUser);
router.patch('/:id/activate', authorize('admin'), userController.activateUser);

/**
 * @swagger
 * /users/{id}/trust:
 *   patch:
 *     summary: Actualizar trust score de un usuario (admin)
 *     description: |
 *       Permite a un administrador incrementar en +1 o resetear a 4 el trust score
 *       de cualquier usuario. El incremento está capped en 4 (no sobrepasa el máximo).
 *       Cuando el score sube por encima de 0, isActive vuelve a true automáticamente,
 *       reactivando la cuenta para crear nuevos bookings/rides.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [increment, reset]
 *                 description: |
 *                   - `increment`: suma +1 al trustScore (cap en 4).
 *                   - `reset`: pone el trustScore en 4 (máximo).
 *     responses:
 *       200:
 *         description: Trust score actualizado o sin cambios (si ya estaba en el máximo)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 trust:
 *                   type: object
 *                   properties:
 *                     previousScore:
 *                       type: integer
 *                     newScore:
 *                       type: integer
 *                     changed:
 *                       type: boolean
 *       400:
 *         description: Acción inválida (debe ser 'increment' o 'reset')
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:id/trust', authorize('admin'), userController.updateTrust);

/**
 * @swagger
 * /users/{id}/trust/history:
 *   get:
 *     summary: Obtener historial de trust score de un usuario (admin)
 *     description: Retorna el historial paginado de cambios de trust score del usuario indicado. Solo accesible por administradores.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Historial de trust score (incluye actor_id populado con nombre/email/type del admin)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       user_id:
 *                         type: string
 *                       previous_score:
 *                         type: integer
 *                       new_score:
 *                         type: integer
 *                       delta:
 *                         type: integer
 *                       reason:
 *                         type: string
 *                         enum: [cancel_gifted_trip_passenger, cancel_in_progress_ride_driver, admin_increment, admin_reset]
 *                       actor_id:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           type:
 *                             type: string
 *                       booking_id:
 *                         type: string
 *                         nullable: true
 *                       ride_id:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/:id/trust/history', authorize('admin'), userController.getTrustHistory);

/**
 * @swagger
 * /users/{id}/stats:
 *   get:
 *     summary: Obtener estadísticas de usuario
 *     description: Retorna estadísticas de viajes y sostenibilidad del usuario
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Estadísticas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Metrics'
 */
router.get('/:id/stats', userController.getUserStats);

module.exports = router;