const express = require('express');
const axios = require('axios');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createAIIrrigationSchedule } = require('../services/irrigation');
const { createNotification } = require('../services/notification');

const router = express.Router();

// Get current weather
router.get('/current', authenticateToken, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Konum bilgisi gerekli' });
        }

        const cacheKey = `${lat},${lon}`;
        const cached = await prisma.weatherCache.findUnique({ where: { location: cacheKey } });

        const now = new Date();
        if (cached && (now - new Date(cached.updatedAt)) < 1800000) {
            return res.json(cached);
        }

        const apiKey = process.env.OPENWEATHER_API_KEY;
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;

        const [currentRes, forecastRes] = await Promise.all([
            axios.get(currentUrl),
            axios.get(forecastUrl)
        ]);

        const weatherData = {
            location: cacheKey,
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
            temperature: currentRes.data.main.temp,
            humidity: currentRes.data.main.humidity,
            condition: currentRes.data.weather[0].description,
            precipitation: currentRes.data.rain ? currentRes.data.rain['1h'] || 0 : 0,
            forecast: forecastRes.data.list.slice(0, 40)
        };

        const updated = await prisma.weatherCache.upsert({
            where: { location: cacheKey },
            update: weatherData,
            create: weatherData
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Hava durumu alınamadı' });
    }
});

// Get 7-day forecast
router.get('/forecast', authenticateToken, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Konum bilgisi gerekli' });
        }

        const apiKey = process.env.OPENWEATHER_API_KEY;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;

        const forecastRes = await axios.get(forecastUrl);

        const forecastsByDay = {};
        forecastRes.data.list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!forecastsByDay[date]) forecastsByDay[date] = [];
            forecastsByDay[date].push(item);
        });

        const dailyForecasts = Object.entries(forecastsByDay).map(([date, items]) => {
            const temps = items.map(i => i.main.temp);
            const humidities = items.map(i => i.main.humidity);
            const rains = items.map(i => i.rain?.['3h'] || 0);

            return {
                date,
                avgTemp: Math.round(temps.reduce((a, b) => a + b) / temps.length * 10) / 10,
                avgHumidity: Math.round(humidities.reduce((a, b) => a + b) / humidities.length),
                totalRain: Math.round(rains.reduce((a, b) => a + b) * 10) / 10,
                condition: items[0].weather[0].description,
                details: items.map(i => ({
                    time: new Date(i.dt * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                    temp: i.main.temp,
                    humidity: i.main.humidity,
                    rain: i.rain?.['3h'] || 0,
                    description: i.weather[0].description
                }))
            };
        });

        const userId = req.user.userId;
        const fields = await prisma.field.findMany({
            where: { userId },
            select: { id: true, name: true }
        });

        for (const forecast of dailyForecasts) {
            if (forecast.totalRain > 20) {
                for (const field of fields) {
                    await createNotification(userId, 'heavy_rain', `🌧️ Ağır Yağış Uyarısı - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.totalRain}mm yağış beklenmektedir.`, new Date(forecast.date));
                }
            }

            if (forecast.avgTemp > 35) {
                for (const field of fields) {
                    await createNotification(userId, 'high_temp', `🌡️ Yüksek Sıcaklık - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.avgTemp}°C sıcaklık bekleniyor.`, new Date(forecast.date));
                }
            } else if (forecast.avgTemp < 5) {
                for (const field of fields) {
                    await createNotification(userId, 'low_temp', `❄️ Düşük Sıcaklık - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.avgTemp}°C sıcaklık bekleniyor.`, new Date(forecast.date));
                }
            }

            if (forecast.avgHumidity < 30) {
                for (const field of fields) {
                    await createNotification(userId, 'low_humidity', `💨 Düşük Nem - ${field.name}`,
                        `${forecast.date} tarihinde %${forecast.avgHumidity} nem bekleniyor.`, new Date(forecast.date));
                }
            }
        }

        res.json({ forecast: dailyForecasts, timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Hava durumu tahmini alınamadı' });
    }
});

module.exports = router;
