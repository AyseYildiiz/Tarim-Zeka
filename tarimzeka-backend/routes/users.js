const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                location: true,
                createdAt: true,
                _count: { select: { fields: true } }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        res.json({ ...user, fieldCount: user._count.fields });
    } catch (error) {
        res.status(500).json({ error: 'Kullanıcı bilgisi alınamadı' });
    }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { name, email, phone, location } = req.body;

        if (email && email !== req.user.email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                return res.status(400).json({ error: 'Bu email zaten kullanılıyor' });
            }
        }

        const updated = await prisma.user.update({
            where: { id: req.user.userId },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone !== undefined && { phone: phone || null }),
                ...(location !== undefined && { location: location || null })
            },
            select: { id: true, email: true, name: true, phone: true, location: true, createdAt: true }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Profil güncellenemedi' });
    }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Mevcut şifre hatalı' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: req.user.userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Şifre başarıyla değiştirildi' });
    } catch (error) {
        res.status(500).json({ error: 'Şifre değiştirilemedi' });
    }
});

// Delete account
router.delete('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const userFields = await prisma.field.findMany({
            where: { userId },
            select: { id: true }
        });
        const fieldIds = userFields.map(f => f.id);

        if (fieldIds.length > 0) {
            await prisma.irrigationSchedule.deleteMany({ where: { fieldId: { in: fieldIds } } });
            await prisma.irrigationLog.deleteMany({ where: { fieldId: { in: fieldIds } } });
            await prisma.soilAnalysis.deleteMany({ where: { fieldId: { in: fieldIds } } });
        }

        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.field.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });

        res.json({ message: 'Hesap başarıyla silindi' });
    } catch (error) {
        res.status(500).json({ error: 'Hesap silinemedi' });
    }
});

module.exports = router;
