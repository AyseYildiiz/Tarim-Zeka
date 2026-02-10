const prisma = require('./config/database');

// Geleneksel sulama miktarları
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

async function test() {
    try {
        const fields = await prisma.field.findMany({
            select: { id: true, area: true, cropType: true }
        });
        console.log('Fields:', fields.length);

        const fieldMap = Object.fromEntries(fields.map(f => [f.id, f]));

        const schedules = await prisma.irrigationSchedule.findMany({
            select: { id: true, waterAmount: true, fieldId: true }
        });
        console.log('Schedules:', schedules.length);

        let potentialSmartWater = 0;
        let potentialTraditionalWater = 0;

        schedules.forEach(s => {
            const field = fieldMap[s.fieldId];
            const areaM2 = (field?.area || 1) * 1000;
            const cropType = field?.cropType || 'default';

            const smartWater = (s.waterAmount || 0) * areaM2;
            const traditionalPerM2 = traditionalWaterUsage[cropType] || traditionalWaterUsage['default'];
            const traditionalWater = traditionalPerM2 * areaM2;

            potentialSmartWater += smartWater;
            potentialTraditionalWater += traditionalWater;

            console.log(`Schedule: crop=${cropType}, area=${field?.area}, waterAmount=${s.waterAmount}, smart=${smartWater}, trad=${traditionalWater}`);
        });

        console.log('---');
        console.log('Total Smart:', potentialSmartWater, '(' + (potentialSmartWater / 1000).toFixed(1) + ' Bin L)');
        console.log('Total Traditional:', potentialTraditionalWater, '(' + (potentialTraditionalWater / 1000).toFixed(1) + ' Bin L)');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
