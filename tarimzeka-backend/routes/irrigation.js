const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../services/notification');

const router = express.Router();

// Get irrigation schedules
router.get('/schedules', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, fieldId, status } = req.query;

        const userFields = await prisma.field.findMany({
            where: { userId: req.user.userId },
            select: { id: true, name: true, cropType: true }
        });

        if (userFields.length === 0) {
            return res.json([]);
        }

        const fieldIds = userFields.map(f => f.id);
        const fieldMap = Object.fromEntries(userFields.map(f => [f.id, f]));

        let where = { fieldId: { in: fieldIds } };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (fieldId && fieldIds.includes(fieldId)) {
            where.fieldId = fieldId;
        }

        if (status) {
            where.status = status;
        }

        const schedules = await prisma.irrigationSchedule.findMany({
            where,
            orderBy: { date: 'asc' },
            include: {
                field: { select: { name: true, cropType: true, location: true } }
            }
        });

        res.json(schedules.map(s => ({
            ...s,
            fieldName: fieldMap[s.fieldId]?.name || 'Unknown'
        })));
    } catch (error) {
        res.status(500).json({ error: 'Sulama takvimi alınamadı' });
    }
});

// Update schedule status
router.patch('/schedules/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, actualWaterUsed, notes } = req.body;

        const schedule = await prisma.irrigationSchedule.findUnique({
            where: { id },
            include: { field: { select: { userId: true, name: true } } }
        });

        if (!schedule) {
            return res.status(404).json({ error: 'Sulama kaydı bulunamadı' });
        }

        if (schedule.field.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
        }

        const updateData = { status };

        if (status === 'completed') {
            updateData.completedAt = new Date();
            if (actualWaterUsed !== undefined) {
                updateData.actualWaterUsed = parseFloat(actualWaterUsed);
            }
            if (notes) {
                updateData.notes = notes;
            }

            await prisma.irrigationLog.create({
                data: {
                    fieldId: schedule.fieldId,
                    scheduledDate: schedule.date,
                    waterUsed: actualWaterUsed ? parseFloat(actualWaterUsed) : schedule.waterAmount,
                    duration: null,
                    notes: notes || `Scheduled irrigation completed`
                }
            });

            await createNotification(
                req.user.userId, 'irrigation_completed',
                `✅ Sulama Tamamlandı - ${schedule.field.name}`,
                `${schedule.waterAmount} litre sulama başarıyla tamamlandı.`,
                new Date()
            );
        }

        const updated = await prisma.irrigationSchedule.update({
            where: { id },
            data: updateData
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Sulama kaydı güncellenemedi' });
    }
});

// Manual irrigation log
router.post('/log', authenticateToken, async (req, res) => {
    try {
        const { fieldId, method, waterUsed, duration, notes } = req.body;

        const field = await prisma.field.findFirst({
            where: { id: fieldId, userId: req.user.userId }
        });

        if (!field) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        const log = await prisma.irrigationLog.create({
            data: {
                fieldId,
                method: method || 'manual',
                waterUsed: parseFloat(waterUsed),
                duration: duration ? parseInt(duration) : null,
                notes: notes || null
            }
        });

        res.json(log);
    } catch (error) {
        res.status(500).json({ error: 'Sulama kaydı oluşturulamadı' });
    }
});

module.exports = router;
