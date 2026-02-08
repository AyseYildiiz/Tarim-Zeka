const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../services/notification');

const router = express.Router();

// Get notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { unreadOnly, type, limit = 50 } = req.query;

        let where = { userId: req.user.userId };

        if (unreadOnly === 'true') {
            where.isRead = false;
        }

        if (type) {
            where.type = type;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: req.user.userId, isRead: false }
        });

        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ error: 'Bildirimler alınamadı' });
    }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
    try {
        const notification = await prisma.notification.findFirst({
            where: { id: req.params.id, userId: req.user.userId }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Bildirim bulunamadı' });
        }

        const updated = await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Bildirim güncellenemedi' });
    }
});

// Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.userId, isRead: false },
            data: { isRead: true }
        });

        res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi' });
    } catch (error) {
        res.status(500).json({ error: 'Bildirimler güncellenemedi' });
    }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const notification = await prisma.notification.findFirst({
            where: { id: req.params.id, userId: req.user.userId }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Bildirim bulunamadı' });
        }

        await prisma.notification.delete({ where: { id: req.params.id } });

        res.json({ message: 'Bildirim silindi' });
    } catch (error) {
        res.status(500).json({ error: 'Bildirim silinemedi' });
    }
});

// Create notification (for testing)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { type, title, message, scheduledFor } = req.body;

        const notification = await createNotification(
            req.user.userId,
            type || 'info',
            title || 'Test Notification',
            message || 'This is a test notification',
            scheduledFor ? new Date(scheduledFor) : new Date()
        );

        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Bildirim oluşturulamadı' });
    }
});

module.exports = router;
