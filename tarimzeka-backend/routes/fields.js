const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createAIIrrigationSchedule } = require('../services/irrigation');

const router = express.Router();

// Create field
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, location, latitude, longitude, soilType, cropType, area } = req.body;

        const field = await prisma.field.create({
            data: {
                userId: req.user.userId,
                name,
                location,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                soilType,
                cropType,
                area: area ? parseFloat(area) : null
            }
        });

        await createAIIrrigationSchedule(field.id, cropType, soilType, latitude, longitude);

        res.json(field);
    } catch (error) {
        res.status(500).json({ error: 'Tarla eklenemedi' });
    }
});

// Get all fields
router.get('/', authenticateToken, async (req, res) => {
    try {
        const fields = await prisma.field.findMany({
            where: { userId: req.user.userId },
            include: {
                schedules: {
                    where: { date: { gte: new Date() }, status: 'pending' },
                    orderBy: { date: 'asc' },
                    take: 1
                },
                soilAnalyses: {
                    orderBy: { analysisDate: 'desc' },
                    take: 1
                }
            }
        });

        res.json(fields);
    } catch (error) {
        res.status(500).json({ error: 'Tarlalar getirilemedi' });
    }
});

// Get single field
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const field = await prisma.field.findFirst({
            where: { id: req.params.id, userId: req.user.userId },
            include: {
                soilAnalyses: { orderBy: { analysisDate: 'desc' } },
                schedules: {
                    orderBy: [{ status: 'asc' }, { date: 'desc' }],
                    take: 100
                }
            }
        });

        if (!field) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        res.json(field);
    } catch (error) {
        res.status(500).json({ error: 'Tarla bilgisi alınamadı' });
    }
});

// Update field
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, latitude, longitude, soilType, cropType, area } = req.body;

        if (!name || !cropType) {
            return res.status(400).json({ error: 'Tarla adı ve ürün türü zorunludur' });
        }

        const existingField = await prisma.field.findFirst({
            where: { id, userId: req.user.userId }
        });

        if (!existingField) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        const updatedField = await prisma.field.update({
            where: { id },
            data: {
                name,
                location: location || '',
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                soilType: soilType || 'Bilmiyorum',
                cropType,
                area: area ? parseFloat(area) : null
            }
        });

        const shouldRecalculate =
            existingField.cropType !== cropType ||
            existingField.soilType !== soilType ||
            existingField.latitude !== (latitude ? parseFloat(latitude) : null) ||
            existingField.longitude !== (longitude ? parseFloat(longitude) : null);

        if (shouldRecalculate && updatedField.latitude && updatedField.longitude) {
            try {
                await prisma.irrigationSchedule.deleteMany({
                    where: { fieldId: id, status: 'pending' }
                });

                await createAIIrrigationSchedule(
                    id, updatedField.cropType, updatedField.soilType,
                    updatedField.latitude, updatedField.longitude
                );
            } catch (scheduleError) {
                // Continue even if schedule recalculation fails
            }
        }

        res.json(updatedField);
    } catch (error) {
        res.status(500).json({ error: 'Tarla güncellenemedi' });
    }
});

// Delete field
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const existingField = await prisma.field.findFirst({
            where: { id, userId: req.user.userId }
        });

        if (!existingField) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        await prisma.irrigationSchedule.deleteMany({ where: { fieldId: id } });
        await prisma.irrigationLog.deleteMany({ where: { fieldId: id } });
        await prisma.soilAnalysis.deleteMany({ where: { fieldId: id } });
        await prisma.field.delete({ where: { id } });

        res.json({ message: 'Tarla silindi' });
    } catch (error) {
        res.status(500).json({ error: 'Tarla silinemedi' });
    }
});

// Calculate irrigation schedule for field
router.post('/:fieldId/calculate-irrigation-schedule', authenticateToken, async (req, res) => {
    try {
        const { fieldId } = req.params;

        const field = await prisma.field.findFirst({
            where: { id: fieldId, userId: req.user.userId }
        });

        if (!field) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        if (!field.latitude || !field.longitude) {
            return res.status(400).json({ error: 'Tarla konumu ayarlanmalıdır' });
        }

        await prisma.irrigationSchedule.deleteMany({
            where: { fieldId, status: 'pending' }
        });

        const schedule = await createAIIrrigationSchedule(
            fieldId, field.cropType, field.soilType, field.latitude, field.longitude
        );

        res.json({ message: 'Sulama takvimi hesaplandı', schedule, fieldId });
    } catch (error) {
        res.status(500).json({ error: 'Sulama takvimi hesaplanamadı' });
    }
});

module.exports = router;
