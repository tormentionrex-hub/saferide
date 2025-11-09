const { Notification } = require('../models');
const logger = require('../utils/logger');
const eventEmitter = require('../events/eventEmitter');

// Array ara cola de notificaciones en memoria
const notificationQueue =[];
let isProcessing = false;

/**
 * Agregar notificacion a la cola
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
 * Procesar cola de notificaciones
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

            // Crear notificacion en la base de datos
            const notification = await Notification.create({
                user_id: notificationData.userId,
                message: notificationData.message,
                type: notificationData.type,
                status: 'unread',
                relatedEntity: notificationData.relatedEntity || null,
                date: new Date(),
            });
            logger.success(`✅ Notification created with ID: ${notification._id}`);
            // TODO: Integrar con servicio de envio de notificaciones push/email si es necesario o servicios de push notifications
            // await sendPushNotification(notificationData.userId, notificationData.message);

            // Emitir evento de notificacion enviada
            eventEmitter.emit('notification:sent', notification);

        } catch (error) {
            logger.error('❌ Error processing notification:', error);

            // Reintentar si falla (maximo 3 reintentos)
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

        // Pequeña pausa entre procesamiento de notificaciones
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
    userIds.foreach(userId => {
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