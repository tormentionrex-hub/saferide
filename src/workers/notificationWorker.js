const { sendNotification: deliverNotification } = require('../services/notificationService');
const logger = require('../utils/logger');
const eventEmitter = require('../events/eventEmitter');

// Array for notification queue in memory
const notificationQueue =[];
let isProcessing = false;

/**
 * Add notification to the queue
 */
const queueNotification = (notificationData) => {
    notificationQueue.push(notificationData);
    logger.info(`🔔 Notification queued. Queue size: ${notificationQueue.length}`);

    // Iniciar procesamiento si no esta en curso
    if (!isProcessing) {
        processQueue();
    }
};

/**
 * Process notification queue
 */

const processQueue = async () => {
    if (isProcessing || notificationQueue.length === 0) {
        return;
    }
    isProcessing = true;

    while (notificationQueue.length > 0) {
        const notificationData = notificationQueue.shift();
        try {
            logger.info(`🚀 Processing notification for user: ${notificationData.userId}`);

            // Guarda la notificación y envía la push del sistema con el mismo
            // servicio que usan los controladores (respeta optIn y el token
            // del usuario). Antes la cola solo guardaba en la base, así que
            // los recordatorios programados nunca llegaban como push.
            const notification = await deliverNotification(
                notificationData.userId,
                notificationData.message,
                notificationData.type,
                notificationData.relatedEntity || null
            );
            logger.success(`✅ Notification created with ID: ${notification._id}`);

            // Emit notification sent event
            eventEmitter.emit('notification:sent', notification);

        } catch (error) {
            logger.error('❌ Error processing notification:', error);

            // Retry if fails (maximum 3 retries)
            if (!notificationData.retries) {
                notificationData.retries = 0;
            }

            if (notificationData.retries < 3) {
                notificationData.retries++;
                notificationQueue.push(notificationData);
                logger.warn(`⚠️  Retrying re-queued. Retry: ${notificationData.retries}/3`);
            } else {
                logger.error(`❌ Notification failed after 3 retries. Data: ${JSON.stringify(notificationData)}`);
            }
        }

        // Small pause between processing notifications
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    isProcessing = false;
};

/**
 * Enviar notificacion (agregando a la cola)
 */
const sendNotification = (userId, message, type, relatedEntity = null) => {
    queueNotification({
        userId,
        message,
        type,
        relatedEntity,
    });
};

/**
 * Enviar notificaciones en lote
 */
const sendBulkNotifications = (userIds, message, type) => {
    userIds.forEach(userId => {
        queueNotification({
            userId,
            message,
            type,
        });
    });
    logger.info(`🔔 ${userIds.length} notifications queued.`);
};

module.exports = {
    sendNotification,
    sendBulkNotifications,
    processQueue,
};