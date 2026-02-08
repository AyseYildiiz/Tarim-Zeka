const axios = require('axios');
const prisma = require('../config/database');
const { normalizeTrKey, normalizeMapKeys } = require('../utils/helpers');
const { createNotification } = require('./notification');

// Crop profiles for irrigation
const cropProfiles = {
    'buğday': { waterMin: 3, waterMax: 5, tempOptimal: 20, tempMin: 0, tempMax: 30, humidityOptimal: 45 },
    'arpa': { waterMin: 3, waterMax: 5, tempOptimal: 18, tempMin: 0, tempMax: 28, humidityOptimal: 45 },
    'çavdar': { waterMin: 2.5, waterMax: 4.5, tempOptimal: 18, tempMin: -5, tempMax: 28, humidityOptimal: 40 },
    'mercimek': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 40 },
    'nohut': { waterMin: 2, waterMax: 3.5, tempOptimal: 20, tempMin: 5, tempMax: 32, humidityOptimal: 35 },
    'domates': { waterMin: 5, waterMax: 8, tempOptimal: 25, tempMin: 15, tempMax: 35, humidityOptimal: 60 },
    'biber': { waterMin: 4.5, waterMax: 7, tempOptimal: 25, tempMin: 15, tempMax: 35, humidityOptimal: 60 },
    'patlıcan': { waterMin: 5, waterMax: 8, tempOptimal: 26, tempMin: 18, tempMax: 35, humidityOptimal: 65 },
    'salatalık': { waterMin: 5, waterMax: 7, tempOptimal: 24, tempMin: 18, tempMax: 32, humidityOptimal: 65 },
    'kabak': { waterMin: 4.5, waterMax: 6.5, tempOptimal: 23, tempMin: 15, tempMax: 32, humidityOptimal: 60 },
    'patates': { waterMin: 4, waterMax: 6, tempOptimal: 20, tempMin: 10, tempMax: 28, humidityOptimal: 50 },
    'soğan': { waterMin: 3, waterMax: 5, tempOptimal: 18, tempMin: 8, tempMax: 28, humidityOptimal: 50 },
    'sarımsak': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 5, tempMax: 25, humidityOptimal: 45 },
    'havuç': { waterMin: 3.5, waterMax: 5, tempOptimal: 18, tempMin: 8, tempMax: 28, humidityOptimal: 50 },
    'lahana': { waterMin: 3.5, waterMax: 5.5, tempOptimal: 18, tempMin: 8, tempMax: 28, humidityOptimal: 55 },
    'marul': { waterMin: 3, waterMax: 5, tempOptimal: 16, tempMin: 5, tempMax: 24, humidityOptimal: 55 },
    'ispanak': { waterMin: 2.5, waterMax: 4, tempOptimal: 15, tempMin: 5, tempMax: 22, humidityOptimal: 50 },
    'elma': { waterMin: 2.5, waterMax: 4.5, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 50 },
    'armut': { waterMin: 3, waterMax: 5, tempOptimal: 19, tempMin: 8, tempMax: 28, humidityOptimal: 50 },
    'çilek': { waterMin: 4, waterMax: 6, tempOptimal: 18, tempMin: 8, tempMax: 26, humidityOptimal: 60 },
    'kiraz': { waterMin: 2, waterMax: 4, tempOptimal: 20, tempMin: 10, tempMax: 28, humidityOptimal: 45 },
    'üzüm': { waterMin: 2, waterMax: 4.5, tempOptimal: 20, tempMin: 10, tempMax: 30, humidityOptimal: 40 },
    'şeftali': { waterMin: 3, waterMax: 5, tempOptimal: 22, tempMin: 12, tempMax: 32, humidityOptimal: 45 },
    'kayısı': { waterMin: 2.5, waterMax: 4.5, tempOptimal: 21, tempMin: 10, tempMax: 30, humidityOptimal: 40 },
    'erik': { waterMin: 3, waterMax: 5, tempOptimal: 20, tempMin: 10, tempMax: 28, humidityOptimal: 45 },
    'karpuz': { waterMin: 5, waterMax: 7.5, tempOptimal: 26, tempMin: 18, tempMax: 35, humidityOptimal: 50 },
    'kavun': { waterMin: 4.5, waterMax: 7, tempOptimal: 25, tempMin: 18, tempMax: 32, humidityOptimal: 50 },
    'ayçiçeği': { waterMin: 3.5, waterMax: 5.5, tempOptimal: 22, tempMin: 10, tempMax: 32, humidityOptimal: 45 },
    'kanola': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 45 },
    'susam': { waterMin: 3, waterMax: 5, tempOptimal: 26, tempMin: 18, tempMax: 35, humidityOptimal: 40 },
    'pamuk': { waterMin: 6, waterMax: 8, tempOptimal: 26, tempMin: 18, tempMax: 38, humidityOptimal: 50 },
    'iplik bitkileri': { waterMin: 4, waterMax: 6, tempOptimal: 22, tempMin: 12, tempMax: 32, humidityOptimal: 45 },
    'mısır': { waterMin: 5, waterMax: 7, tempOptimal: 24, tempMin: 15, tempMax: 32, humidityOptimal: 55 },
    'zeytin': { waterMin: 3.5, waterMax: 6.5, tempOptimal: 21, tempMin: 10, tempMax: 32, humidityOptimal: 35 },
    'nar': { waterMin: 2, waterMax: 4, tempOptimal: 23, tempMin: 12, tempMax: 32, humidityOptimal: 40 },
    'incir': { waterMin: 2, waterMax: 3.5, tempOptimal: 22, tempMin: 12, tempMax: 32, humidityOptimal: 35 },
    'çay': { waterMin: 5, waterMax: 8, tempOptimal: 20, tempMin: 10, tempMax: 28, humidityOptimal: 70 },
    'kahve': { waterMin: 4, waterMax: 7, tempOptimal: 21, tempMin: 15, tempMax: 28, humidityOptimal: 65 },
    'çiçek': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 8, tempMax: 28, humidityOptimal: 50 },
    'ot (saman)': { waterMin: 2, waterMax: 3.5, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 45 }
};

// Soil type water retention multipliers
const soilMultipliers = {
    'kumlu': 1.3,
    'killi': 0.8,
    'tınlı': 1.0,
    'balçık': 0.85,
    'çakıllı': 1.4
};

// Irrigation intervals by crop
const irrigationIntervals = {
    'buğday': 4, 'arpa': 4, 'çavdar': 4, 'mercimek': 3, 'nohut': 3,
    'domates': 2, 'biber': 2, 'patlıcan': 2, 'salatalık': 1, 'kabak': 2,
    'lahana': 3, 'marul': 2, 'ıspanak': 2, 'patates': 3, 'soğan': 3,
    'sarımsak': 4, 'havuç': 2,
    'elma': 3, 'armut': 3, 'çilek': 2, 'kiraz': 3, 'üzüm': 4,
    'şeftali': 3, 'kayısı': 3, 'erik': 3, 'karpuz': 2, 'kavun': 2,
    'ayçiçeği': 4, 'kanola': 4, 'susam': 3,
    'pamuk': 3, 'iplik bitkileri': 3,
    'mısır': 2, 'zeytin': 7, 'nar': 4, 'incir': 5, 'çay': 3, 'kahve': 3,
    'çiçek': 2, 'ot (saman)': 4
};

// Water needs for basic irrigation schedule (L/m2 per day)
const waterNeeds = {
    'buğday': 4, 'arpa': 3.5, 'çavdar': 3.5, 'mercimek': 3, 'nohut': 2.5,
    'domates': 6, 'biber': 5.5, 'patlıcan': 6.5, 'salatalık': 6, 'kabak': 5.5,
    'patates': 5, 'soğan': 4, 'sarımsak': 3, 'havuç': 4, 'lahana': 4.5,
    'marul': 4, 'ispanak': 3,
    'elma': 3.5, 'armut': 4, 'çilek': 5, 'kiraz': 3, 'üzüm': 3,
    'şeftali': 4, 'kayısı': 3.5, 'erik': 4, 'karpuz': 6, 'kavun': 5.5,
    'ayçiçeği': 4.5, 'kanola': 3.5, 'susam': 4,
    'pamuk': 7, 'iplik bitkileri': 5,
    'mısır': 6, 'zeytin': 2.5, 'nar': 3, 'incir': 2.5,
    'çay': 6.5, 'kahve': 5.5, 'çiçek': 3.5, 'ot (saman)': 2.5
};

async function getAIWaterProfile({ cropType, soilType, lat, lon, month, forecastSummary }) {
    if (!process.env.OPENAI_API_KEY) {
        return null;
    }

    const prompt = `You are an agronomy assistant. Return JSON only.
Crop: ${cropType}
Soil: ${soilType}
Location: lat ${lat}, lon ${lon}
Month: ${month}
Forecast summary (next ~5 days): avgTemp=${forecastSummary.avgTemp.toFixed(1)}°C, avgHumidity=${Math.round(forecastSummary.avgHumidity)}%, totalRain=${forecastSummary.totalRain.toFixed(1)}mm.

Return a JSON object with:
{
  "waterMin": number,
  "waterMax": number,
  "intervalDays": number,
  "recommendedTimeRange": "HH:MM-HH:MM"
}

Be conservative, realistic for field irrigation.`;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const waterMin = Number(parsed.waterMin);
        const waterMax = Number(parsed.waterMax);
        const intervalDays = Number(parsed.intervalDays);
        const recommendedTimeRange = typeof parsed.recommendedTimeRange === 'string'
            ? parsed.recommendedTimeRange
            : null;

        if (!Number.isFinite(waterMin) || !Number.isFinite(waterMax) || !Number.isFinite(intervalDays)) {
            return null;
        }

        return {
            waterMin: Math.max(0.5, Math.min(waterMin, 12)),
            waterMax: Math.max(0.8, Math.min(waterMax, 15)),
            intervalDays: Math.max(1, Math.min(Math.round(intervalDays), 10)),
            recommendedTimeRange
        };
    } catch (error) {
        return null;
    }
}

async function createAIIrrigationSchedule(fieldId, cropType, soilType, lat, lon) {
    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;

        const forecastRes = await axios.get(forecastUrl);
        const forecastItems = forecastRes.data?.list || [];

        const avgTempAll = forecastItems.length
            ? forecastItems.reduce((sum, item) => sum + item.main.temp, 0) / forecastItems.length
            : 20;
        const avgHumidityAll = forecastItems.length
            ? forecastItems.reduce((sum, item) => sum + item.main.humidity, 0) / forecastItems.length
            : 50;
        const totalRainAll = forecastItems.length
            ? forecastItems.reduce((sum, item) => sum + (item.rain?.['3h'] || 0), 0)
            : 0;

        const normalizedCropProfiles = normalizeMapKeys(cropProfiles);
        const normalizedSoilMultipliers = normalizeMapKeys(soilMultipliers);
        const cropKey = normalizeTrKey(cropType);
        const soilKey = normalizeTrKey(soilType);

        const cropProfile = normalizedCropProfiles[cropKey] || normalizedCropProfiles[normalizeTrKey('buğday')];
        const soilMultiplier = normalizedSoilMultipliers[soilKey] || 1.0;

        const aiProfile = await getAIWaterProfile({
            cropType, soilType, lat, lon,
            month: new Date().getMonth() + 1,
            forecastSummary: { avgTemp: avgTempAll, avgHumidity: avgHumidityAll, totalRain: totalRainAll }
        });

        const effectiveProfile = {
            ...cropProfile,
            waterMin: aiProfile?.waterMin ?? cropProfile.waterMin,
            waterMax: aiProfile?.waterMax ?? cropProfile.waterMax
        };

        const normalizedIntervals = normalizeMapKeys(irrigationIntervals);
        const irrigationInterval = aiProfile?.intervalDays || normalizedIntervals[cropKey] || 3;

        const schedules = [];
        for (let i = 0; i < 14; i += irrigationInterval) {
            const scheduleDay = new Date();
            scheduleDay.setDate(scheduleDay.getDate() + i);
            scheduleDay.setHours(0, 0, 0, 0);

            let avgTemp = cropProfile.tempOptimal;
            let avgHumidity = cropProfile.humidityOptimal;
            let totalRain = 0;
            let weatherCondition = 'Açık';

            const scheduleDateStr = scheduleDay.toDateString();
            const forecastForDay = forecastRes.data.list.filter(item => {
                const itemDate = new Date(item.dt * 1000);
                return itemDate.toDateString() === scheduleDateStr;
            });

            if (forecastForDay.length > 0) {
                avgTemp = forecastForDay.reduce((sum, item) => sum + item.main.temp, 0) / forecastForDay.length;
                avgHumidity = forecastForDay.reduce((sum, item) => sum + item.main.humidity, 0) / forecastForDay.length;
                totalRain = forecastForDay.reduce((sum, item) => sum + (item.rain?.['3h'] || 0), 0);
                weatherCondition = forecastForDay[0].weather?.[0]?.description || 'Bilinmiyor';
            }

            let baseWater = (effectiveProfile.waterMin + effectiveProfile.waterMax) / 2;

            // Temperature adjustment
            const tempDiff = Math.abs(avgTemp - effectiveProfile.tempOptimal);
            let tempFactor = 1.0;
            if (avgTemp > effectiveProfile.tempOptimal) {
                tempFactor = 1 + Math.min(tempDiff / 10, 0.5);
            } else if (avgTemp < effectiveProfile.tempOptimal) {
                tempFactor = 1 - Math.min(tempDiff / 20, 0.3);
            }

            // Humidity adjustment
            let humidityFactor = 1.0;
            if (avgHumidity < effectiveProfile.humidityOptimal) {
                const humidityDiff = effectiveProfile.humidityOptimal - avgHumidity;
                humidityFactor = 1 + Math.min(humidityDiff / 100, 0.4);
            } else {
                const humidityDiff = avgHumidity - effectiveProfile.humidityOptimal;
                humidityFactor = 1 - Math.min(humidityDiff / 150, 0.2);
            }

            let waterAmount = baseWater * tempFactor * humidityFactor * soilMultiplier;

            // Rain adjustment
            if (totalRain > 15) {
                waterAmount = 0;
            } else if (totalRain > 10) {
                waterAmount *= 0.2;
            } else if (totalRain > 5) {
                waterAmount *= 0.5;
            } else if (totalRain > 2) {
                waterAmount *= 0.7;
            }

            // Season adjustment
            const month = scheduleDay.getMonth();
            if (month >= 5 && month <= 8) {
                waterAmount *= 1.2;
            } else if (month >= 11 || month <= 2) {
                waterAmount *= 0.8;
            }

            waterAmount = Math.max(0, Math.round(waterAmount * 10) / 10);

            // Recommended time
            let recommendedTime = aiProfile?.recommendedTimeRange || '06:00-08:00';
            if (avgTemp > 30) recommendedTime = '04:30-06:30';
            else if (avgTemp > 28) recommendedTime = '05:00-07:00';
            else if (avgTemp > 24) recommendedTime = '06:00-08:00';
            else if (avgTemp > 18) recommendedTime = '07:00-09:00';
            else if (avgTemp < 12) recommendedTime = '10:00-12:00';
            else recommendedTime = '08:00-10:00';

            // Note
            let note = null;
            if (waterAmount === 0) {
                note = `Yağmur nedeniyle sulama gerekli değil (${totalRain.toFixed(1)}mm yağış bekleniyor).`;
            } else if (totalRain > 5) {
                note = `Yağış bekleniyor (${totalRain.toFixed(1)}mm). Sulama miktarı azaltıldı.`;
            } else if (avgTemp > effectiveProfile.tempOptimal + 5) {
                note = `Yüksek sıcaklık (${avgTemp.toFixed(1)}°C). Daha fazla su gerekebilir.`;
            } else if (avgHumidity < effectiveProfile.humidityOptimal - 20) {
                note = `Düşük nem (%${avgHumidity}). Su ihtiyacı artırıldı.`;
            } else if (avgTemp < effectiveProfile.tempOptimal - 8) {
                note = `Düşük sıcaklık (${avgTemp.toFixed(1)}°C). Su ihtiyacı azaltıldı.`;
            }

            schedules.push({
                fieldId,
                date: scheduleDay,
                recommendedTime,
                waterAmount,
                weatherTemp: Math.round(avgTemp * 10) / 10,
                weatherHumidity: Math.round(avgHumidity),
                weatherCondition,
                note,
                status: 'pending'
            });
        }

        if (schedules.length > 0) {
            await prisma.irrigationSchedule.createMany({ data: schedules });

            const field = await prisma.field.findUnique({
                where: { id: fieldId },
                select: { userId: true, name: true }
            });

            if (field) {
                const firstNotifications = schedules.slice(0, 3).filter(s => s.waterAmount > 0);

                for (const schedule of firstNotifications) {
                    const scheduleDate = new Date(schedule.date);
                    const dateStr = scheduleDate.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });

                    await createNotification(
                        field.userId,
                        'irrigation',
                        `⏰ Sulama Zamanı - ${field.name}`,
                        `${dateStr} ${schedule.recommendedTime} arası ${schedule.waterAmount}L/m² su önerilmektedir.`,
                        schedule.date
                    );
                }

                const heavyRainSchedule = schedules.find(s => s.note && s.note.includes('Yoğun yağmur'));
                if (heavyRainSchedule) {
                    const scheduleDate = new Date(heavyRainSchedule.date);
                    const dateStr = scheduleDate.toLocaleDateString('tr-TR', { weekday: 'long', month: 'short', day: 'numeric' });

                    await createNotification(
                        field.userId,
                        'weather_warning',
                        `🌧️ Yağış Uyarısı - ${field.name}`,
                        `${dateStr} yoğun yağış bekleniyor. Sulama gerekli olmayabilir.`,
                        heavyRainSchedule.date
                    );
                }
            }
        }

        return schedules;
    } catch (error) {
        return await createIrrigationSchedule(fieldId, cropType, soilType, lat, lon);
    }
}

async function createIrrigationSchedule(fieldId, cropType, soilType, lat, lon) {
    try {
        const weatherData = await getWeatherForLocation(`${lat},${lon}`);

        const schedules = [];
        const today = new Date();

        const normalizedWaterNeeds = normalizeMapKeys(waterNeeds);
        const cropKey = normalizeTrKey(cropType);
        const baseWater = normalizedWaterNeeds[cropKey] || 5;

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);

            const forecastDay = weatherData?.forecast?.[i * 8] || {};
            const temp = forecastDay.main?.temp || 25;
            const humidity = forecastDay.main?.humidity || 50;
            const rain = forecastDay.rain?.['3h'] || 0;

            let waterAmount = baseWater;

            if (temp > 30) waterAmount *= 1.3;
            else if (temp > 25) waterAmount *= 1.1;
            else if (temp < 15) waterAmount *= 0.8;

            if (humidity < 40) waterAmount *= 1.2;
            else if (humidity > 70) waterAmount *= 0.8;

            const soilKey = normalizeTrKey(soilType);
            if (soilKey === 'kumlu') waterAmount *= 1.2;
            else if (soilKey === 'killi') waterAmount *= 0.9;

            if (rain > 5) {
                waterAmount = 0;
            }

            schedules.push({
                fieldId,
                date,
                recommendedTime: temp > 28 ? '06:00-08:00' : '07:00-09:00',
                waterAmount: Math.round(waterAmount * 10) / 10,
                weatherTemp: temp,
                weatherHumidity: humidity,
                weatherCondition: forecastDay.weather?.[0]?.description || 'Bilinmiyor',
                note: rain > 5 ? 'Yağmur bekleniyor, sulama gerekli değil' : null,
                status: 'pending'
            });
        }

        if (schedules.length > 0) {
            await prisma.irrigationSchedule.createMany({ data: schedules });
        }

        return schedules;
    } catch (error) {
        return [];
    }
}

async function getWeatherForLocation(location) {
    try {
        if (!location) return null;

        const [lat, lon] = location.split(',');
        if (!lat || !lon) return null;

        const cached = await prisma.weatherCache.findUnique({
            where: { location }
        });

        if (cached && (new Date() - new Date(cached.updatedAt)) < 1800000) {
            return cached;
        }

        return null;
    } catch (error) {
        return null;
    }
}

module.exports = {
    createAIIrrigationSchedule,
    createIrrigationSchedule,
    getWeatherForLocation,
    getAIWaterProfile
};
