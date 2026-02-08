const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getWeekNumber } = require('../utils/helpers');

const router = express.Router();

// Get savings summary
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userFields = await prisma.field.findMany({
            where: { userId: req.user.userId },
            select: { id: true, area: true }
        });

        if (userFields.length === 0) {
            return res.json({
                totalWaterSaved: 0,
                totalMoneySaved: 0,
                weeklyStats: [],
                monthlyStats: []
            });
        }

        const fieldIds = userFields.map(f => f.id);
        const totalArea = userFields.reduce((sum, f) => sum + (f.area || 1), 0);

        const schedules = await prisma.irrigationSchedule.findMany({
            where: {
                fieldId: { in: fieldIds },
                status: 'completed',
                completedAt: { not: null }
            },
            select: { waterAmount: true, actualWaterUsed: true, completedAt: true }
        });

        let totalWaterSaved = 0;
        const weeklyMap = new Map();
        const monthlyMap = new Map();

        schedules.forEach(s => {
            const saved = (s.waterAmount || 0) - (s.actualWaterUsed || s.waterAmount || 0);
            if (saved > 0) totalWaterSaved += saved;

            const date = new Date(s.completedAt);
            const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + Math.max(0, saved));
            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Math.max(0, saved));
        });

        const waterPricePerLiter = 0.015;
        const totalMoneySaved = totalWaterSaved * waterPricePerLiter;

        res.json({
            totalWaterSaved: Math.round(totalWaterSaved),
            totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
            weeklyStats: Array.from(weeklyMap.entries())
                .map(([week, saved]) => ({ week, waterSaved: Math.round(saved) }))
                .sort((a, b) => a.week.localeCompare(b.week))
                .slice(-8),
            monthlyStats: Array.from(monthlyMap.entries())
                .map(([month, saved]) => ({ month, waterSaved: Math.round(saved) }))
                .sort((a, b) => a.month.localeCompare(b.month))
                .slice(-12),
            totalFieldArea: totalArea,
            fieldCount: userFields.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Tasarruf verileri alınamadı' });
    }
});

module.exports = router;
