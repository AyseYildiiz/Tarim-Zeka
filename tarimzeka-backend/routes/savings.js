const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getWeekNumber } = require('../utils/helpers');

const router = express.Router();

// Geleneksel sulama miktarları (L/m² - verimsiz sulama = akıllı sulamanın 2-3 katı)
const traditionalWaterUsage = {
    'Buğday': 12, 'Arpa': 11, 'Mısır': 18, 'Ayçiçeği': 14, 'Pamuk': 21,
    'Soya': 15, 'Şeker Pancarı': 18, 'Patates': 15, 'Domates': 18,
    'Biber': 15, 'Patlıcan': 16, 'Salatalık': 15, 'Kabak': 14,
    'Kavun': 14, 'Karpuz': 18, 'Soğan': 12, 'Sarımsak': 10, 'Havuç': 12,
    'Marul': 12, 'Ispanak': 10, 'Lahana': 14, 'Fasulye': 14, 'Nohut': 10,
    'Mercimek': 9, 'Çilek': 15, 'Üzüm': 12, 'Elma': 12, 'Armut': 12,
    'Şeftali': 14, 'Kayısı': 12, 'Kiraz': 10, 'Zeytin': 10, 'Ceviz': 12,
    'default': 15
};

// Get savings summary
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userFields = await prisma.field.findMany({
            where: { userId: req.user.userId },
            select: { id: true, area: true, cropType: true }
        });

        if (userFields.length === 0) {
            return res.json({
                totalWaterSaved: 0,
                totalMoneySaved: 0,
                savingPercentage: 0,
                totalSmartWater: 0,
                totalTraditionalWater: 0,
                weeklyStats: [],
                monthlyStats: [],
                totalFieldArea: 0,
                fieldCount: 0,
                completedIrrigations: 0,
                potentialSavings: 0,
                comparisonNote: 'Henüz tarla eklenmedi'
            });
        }

        const fieldIds = userFields.map(f => f.id);
        const fieldMap = Object.fromEntries(userFields.map(f => [f.id, f]));
        const totalArea = userFields.reduce((sum, f) => sum + (f.area || 1), 0);

        // Tüm schedule'ları al (pending dahil)
        const allSchedules = await prisma.irrigationSchedule.findMany({
            where: { fieldId: { in: fieldIds } },
            select: { fieldId: true, waterAmount: true, actualWaterUsed: true, status: true, completedAt: true, createdAt: true }
        });

        const completedSchedules = allSchedules.filter(s => s.status === 'completed');

        let totalWaterSaved = 0;
        let totalSmartWater = 0;
        let totalTraditionalWater = 0;
        const weeklyMap = new Map();
        const monthlyMap = new Map();

        // Tamamlanmış sulamalardan gerçek tasarruf
        completedSchedules.forEach(s => {
            const field = fieldMap[s.fieldId];
            const areaM2 = (field?.area || 1) * 1000;
            const cropType = field?.cropType || 'default';

            const smartWater = (s.actualWaterUsed || s.waterAmount || 0) * areaM2;
            const traditionalPerM2 = traditionalWaterUsage[cropType] || traditionalWaterUsage['default'];
            const traditionalWater = traditionalPerM2 * areaM2;
            const saved = traditionalWater - smartWater;

            totalSmartWater += smartWater;
            totalTraditionalWater += traditionalWater;
            if (saved > 0) totalWaterSaved += saved;

            const date = new Date(s.completedAt || s.createdAt);
            const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + Math.max(0, saved));
            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Math.max(0, saved));
        });

        // Tüm planlı sulamalardan potansiyel tasarruf hesapla
        let potentialWaterSaved = 0;
        let potentialTraditionalWater = 0;
        let potentialSmartWater = 0;

        if (allSchedules.length > 0) {
            allSchedules.forEach(s => {
                const field = fieldMap[s.fieldId];
                const areaM2 = (field?.area || 1) * 1000;
                const cropType = field?.cropType || 'default';

                const smartWater = (s.waterAmount || 0) * areaM2;
                const traditionalPerM2 = traditionalWaterUsage[cropType] || traditionalWaterUsage['default'];
                const traditionalWater = traditionalPerM2 * areaM2;
                const saved = traditionalWater - smartWater;

                potentialSmartWater += smartWater;
                potentialTraditionalWater += traditionalWater;
                if (saved > 0) potentialWaterSaved += saved;
            });
        } else {
            // Schedule yoksa tarla bazlı potansiyel hesapla (yıllık tahmini)
            userFields.forEach(field => {
                const areaM2 = (field.area || 1) * 1000;
                const cropType = field.cropType || 'default';

                // Varsayılan akıllı sulama: 4 L/m² (ortalama)
                const smartPerM2 = 4;
                const traditionalPerM2 = traditionalWaterUsage[cropType] || traditionalWaterUsage['default'];

                // Yılda ortalama 30 sulama varsayalım
                const yearlySmartWater = smartPerM2 * areaM2 * 30;
                const yearlyTraditionalWater = traditionalPerM2 * areaM2 * 30;
                const saved = yearlyTraditionalWater - yearlySmartWater;

                potentialSmartWater += yearlySmartWater;
                potentialTraditionalWater += yearlyTraditionalWater;
                if (saved > 0) potentialWaterSaved += saved;
            });
        }

        const waterPricePerLiter = 0.015; // TL/Litre
        const totalMoneySaved = totalWaterSaved * waterPricePerLiter;
        const potentialMoneySaved = potentialWaterSaved * waterPricePerLiter;

        // Yüzde hesaplama - gerçek veya potansiyel
        let savingPercentage;
        if (totalTraditionalWater > 0) {
            savingPercentage = Math.round((totalWaterSaved / totalTraditionalWater) * 100);
        } else if (potentialTraditionalWater > 0) {
            savingPercentage = Math.round((potentialWaterSaved / potentialTraditionalWater) * 100);
        } else {
            savingPercentage = 0;
        }

        res.json({
            totalWaterSaved: Math.round(totalWaterSaved),
            totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
            savingPercentage,
            totalSmartWater: Math.round(totalSmartWater),
            totalTraditionalWater: Math.round(totalTraditionalWater),
            potentialWaterSaved: Math.round(potentialWaterSaved),
            potentialMoneySaved: Math.round(potentialMoneySaved * 100) / 100,
            potentialSmartWater: Math.round(potentialSmartWater),
            potentialTraditionalWater: Math.round(potentialTraditionalWater),
            weeklyStats: Array.from(weeklyMap.entries())
                .map(([week, saved]) => ({ week, waterSaved: Math.round(saved) }))
                .sort((a, b) => a.week.localeCompare(b.week))
                .slice(-8),
            monthlyStats: Array.from(monthlyMap.entries())
                .map(([month, saved]) => ({ month, waterSaved: Math.round(saved) }))
                .sort((a, b) => a.month.localeCompare(b.month))
                .slice(-12),
            totalFieldArea: totalArea,
            fieldCount: userFields.length,
            completedIrrigations: completedSchedules.length,
            totalSchedules: allSchedules.length,
            comparisonNote: completedSchedules.length > 0
                ? 'Geleneksel sulama yöntemiyle karşılaştırma'
                : (allSchedules.length > 0
                    ? 'Potansiyel tasarruf (sulamalar tamamlandıkça güncellenir)'
                    : 'Yıllık tahmini tasarruf potansiyeli')
        });
    } catch (error) {
        res.status(500).json({ error: 'Tasarruf verileri alınamadı' });
    }
});

module.exports = router;
