const prisma = require('../config/database');

async function createNotification(userId, type, title, message, scheduledFor = null) {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                isRead: false
            }
        });
        return notification;
    } catch (error) {
        return null;
    }
}

module.exports = { createNotification };
