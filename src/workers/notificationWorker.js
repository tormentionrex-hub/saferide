const { Notification } = require('../models');
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

            // Create notification in the database
            const notification = await Notification.create({
                user_id: notificationData.userId,
                message: notificationData.message,
                type: notificationData.type,
                status: 'unread',
                relatedEntity: notificationData.relatedEntity || null,
                date: new Date(),
            });
            logger.success(`✅ Notification created with ID: ${notification._id}`);
            // TODO: Integrate with push/email notification service if needed or push notification services
            // await sendPushNotification(notificationData.userId, notificationData.message);

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