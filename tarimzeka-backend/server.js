require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary bağlantısını kontrol et
console.log('☁️ Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
    api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
});

if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_actual_cloud_name') {
    console.warn('⚠️ Cloudinary yapılandırılmamış! .env dosyasını kontrol edin.');
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token gerekli' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ Token verification error:', err.message);
            return res.status(403).json({ error: 'Geçersiz token' });
        }

        console.log('✅ Token decoded:', user);
        req.user = user;  // user'da userId var
        next();
    });
};

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password, location } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu email zaten kullanılıyor' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                location
            }
        });

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                location: user.location
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Email veya şifre hatalı' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email veya şifre hatalı' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                location: user.location
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
    }
});

// ============ LOCATION SEARCH ROUTES ============

// Nominatim (OpenStreetMap) ile konum arama
app.get('/api/location/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Arama terimi en az 2 karakter olmalı' });
        }

        console.log('🔍 Location search:', query);

        // Birden fazla arama stratejisi kullan
        const searchStrategies = [
            // 1. Doğrudan arama
            {
                q: query,
                format: 'json',
                addressdetails: 1,
                limit: 25,
                countrycodes: 'tr',
                'accept-language': 'tr',
                namedetails: 1,
                extratags: 1,
                dedupe: 0
            },
            // 2. Türkiye ekleyerek arama
            {
                q: `${query}, Türkiye`,
                format: 'json',
                addressdetails: 1,
                limit: 15,
                countrycodes: 'tr',
                'accept-language': 'tr',
                namedetails: 1,
                extratags: 1,
                dedupe: 0
            }
        ];

        let allResults = [];

        for (const params of searchStrategies) {
            try {
                const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                    params,
                    headers: {
                        'User-Agent': 'TarimZeka-App/1.0 (Agricultural Mobile Application)',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                });

                if (response.data && response.data.length > 0) {
                    allResults = [...allResults, ...response.data];
                }

                // Rate limiting için kısa bekleme
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.log('Search strategy failed:', err.message);
            }
        }

        // Benzersiz sonuçları filtrele
        const uniqueMap = new Map();
        allResults.forEach(item => {
            if (!uniqueMap.has(item.place_id)) {
                uniqueMap.set(item.place_id, item);
            }
        });
        allResults = Array.from(uniqueMap.values());

        console.log(`📊 Raw results: ${allResults.length}`);

        const results = allResults.map((item, index) => {
            const address = item.address || {};
            const nameDetails = item.namedetails || {};
            const extraTags = item.extratags || {};
            const itemType = item.type?.toLowerCase() || '';
            const itemClass = item.class?.toLowerCase() || '';

            // Detaylı tip belirleme
            let type = 'place';
            let category = '';

            // POI - Önemli Yerler (Binalar, Kurumlar, İşletmeler)
            if (itemClass === 'amenity') {
                type = 'poi';
                const amenityTypes = {
                    'hospital': 'Hastane',
                    'clinic': 'Klinik',
                    'pharmacy': 'Eczane',
                    'school': 'Okul',
                    'university': 'Üniversite',
                    'college': 'Kolej',
                    'kindergarten': 'Anaokulu',
                    'library': 'Kütüphane',
                    'bank': 'Banka',
                    'atm': 'ATM',
                    'post_office': 'Postane',
                    'police': 'Polis',
                    'fire_station': 'İtfaiye',
                    'courthouse': 'Adliye',
                    'townhall': 'Belediye',
                    'community_centre': 'Toplum Merkezi',
                    'place_of_worship': 'İbadet Yeri',
                    'mosque': 'Cami',
                    'restaurant': 'Restoran',
                    'cafe': 'Kafe',
                    'fast_food': 'Fast Food',
                    'bar': 'Bar',
                    'pub': 'Pub',
                    'fuel': 'Benzin İstasyonu',
                    'parking': 'Otopark',
                    'bus_station': 'Otobüs Terminali',
                    'taxi': 'Taksi Durağı',
                    'theatre': 'Tiyatro',
                    'cinema': 'Sinema',
                    'marketplace': 'Pazar Yeri',
                    'supermarket': 'Süpermarket'
                };
                category = amenityTypes[itemType] || 'Tesis';
            }
            // Dükkan ve Mağazalar
            else if (itemClass === 'shop') {
                type = 'poi';
                const shopTypes = {
                    'supermarket': 'Süpermarket',
                    'convenience': 'Market',
                    'bakery': 'Fırın',
                    'butcher': 'Kasap',
                    'greengrocer': 'Manav',
                    'clothes': 'Giyim Mağazası',
                    'electronics': 'Elektronik',
                    'furniture': 'Mobilya',
                    'hardware': 'Hırdavat',
                    'mall': 'AVM',
                    'department_store': 'Mağaza'
                };
                category = shopTypes[itemType] || 'Mağaza';
            }
            // Turizm
            else if (itemClass === 'tourism') {
                type = 'poi';
                const tourismTypes = {
                    'hotel': 'Otel',
                    'motel': 'Motel',
                    'guest_house': 'Pansiyon',
                    'museum': 'Müze',
                    'attraction': 'Turistik Yer',
                    'viewpoint': 'Seyir Noktası',
                    'zoo': 'Hayvanat Bahçesi'
                };
                category = tourismTypes[itemType] || 'Turistik Yer';
            }
            // Binalar
            else if (itemClass === 'building') {
                type = 'building';
                const buildingTypes = {
                    'apartments': 'Apartman',
                    'house': 'Ev',
                    'residential': 'Konut',
                    'commercial': 'Ticari Bina',
                    'industrial': 'Sanayi Binası',
                    'retail': 'Mağaza',
                    'office': 'Ofis',
                    'hospital': 'Hastane',
                    'school': 'Okul',
                    'university': 'Üniversite',
                    'mosque': 'Cami',
                    'church': 'Kilise'
                };
                category = buildingTypes[itemType] || 'Bina';
            }
            // Sokak ve Yollar
            else if (itemClass === 'highway' ||
                ['street', 'road', 'residential', 'primary', 'secondary',
                    'tertiary', 'living_street', 'pedestrian', 'footway',
                    'path', 'service', 'unclassified', 'trunk', 'motorway'].includes(itemType)) {
                type = 'street';
                category = 'Sokak/Cadde';
            }
            // Mahalle
            else if (itemType === 'neighbourhood' || itemType === 'suburb' ||
                itemType === 'quarter' || address.neighbourhood || address.suburb) {
                type = 'neighborhood';
                category = 'Mahalle';
            }
            // İlçe/Kasaba
            else if (itemType === 'town' || itemType === 'village' ||
                itemType === 'hamlet' || address.town || address.village) {
                type = 'district';
                category = 'İlçe';
            }
            // Şehir
            else if (itemType === 'city' || itemType === 'administrative' ||
                address.city || address.state) {
                type = 'city';
                category = 'Şehir';
            }
            // Doğal Alanlar
            else if (itemClass === 'natural' || itemClass === 'leisure') {
                type = 'poi';
                const naturalTypes = {
                    'park': 'Park',
                    'garden': 'Bahçe',
                    'playground': 'Oyun Alanı',
                    'sports_centre': 'Spor Merkezi',
                    'stadium': 'Stadyum',
                    'swimming_pool': 'Yüzme Havuzu',
                    'beach': 'Plaj',
                    'forest': 'Orman',
                    'water': 'Su',
                    'lake': 'Göl'
                };
                category = naturalTypes[itemType] || 'Doğal Alan';
            }
            // Ulaşım
            else if (itemClass === 'railway' || itemClass === 'aeroway') {
                type = 'poi';
                const transportTypes = {
                    'station': 'İstasyon',
                    'halt': 'Durak',
                    'aerodrome': 'Havalimanı',
                    'terminal': 'Terminal'
                };
                category = transportTypes[itemType] || 'Ulaşım Noktası';
            }

            // Başlık oluştur
            let title = nameDetails.name || item.name || '';

            if (!title) {
                if (type === 'street') {
                    title = address.road || 'Bilinmeyen Sokak';
                } else if (type === 'neighborhood') {
                    title = address.neighbourhood || address.suburb || 'Bilinmeyen Mahalle';
                } else if (type === 'district') {
                    title = address.town || address.village || address.county || 'Bilinmeyen İlçe';
                } else if (type === 'city') {
                    title = address.city || address.state || address.province || 'Bilinmeyen Şehir';
                } else {
                    title = item.display_name?.split(',')[0] || query;
                }
            }

            // Alt başlık oluştur (hiyerarşik adres)
            const subtitleParts = [];

            // Kategori varsa ekle
            if (category && type !== 'city' && type !== 'district') {
                subtitleParts.push(category);
            }

            // Adres hiyerarşisi
            if (address.road && type !== 'street') {
                subtitleParts.push(address.road);
            }
            if (address.neighbourhood && type !== 'neighborhood') {
                subtitleParts.push(address.neighbourhood);
            } else if (address.suburb && type !== 'neighborhood') {
                subtitleParts.push(address.suburb);
            }
            if ((address.town || address.village || address.county) && type !== 'district') {
                subtitleParts.push(address.town || address.village || address.county);
            }
            if ((address.city || address.state || address.province) && type !== 'city') {
                const city = address.city || address.state || address.province;
                if (!subtitleParts.includes(city)) {
                    subtitleParts.push(city);
                }
            }

            const subtitle = subtitleParts.filter(p => p && p !== title).join(', ') || 'Türkiye';

            // Tam adres
            const fullAddressParts = [];
            if (title && title !== address.road) fullAddressParts.push(title);
            if (address.road && !fullAddressParts.includes(address.road)) fullAddressParts.push(address.road);
            if (address.house_number) fullAddressParts.push(`No: ${address.house_number}`);
            if (address.neighbourhood) fullAddressParts.push(address.neighbourhood);
            if (address.suburb && address.suburb !== address.neighbourhood) fullAddressParts.push(address.suburb);
            if (address.town || address.village) fullAddressParts.push(address.town || address.village);
            if (address.county) fullAddressParts.push(address.county);
            if (address.city || address.state || address.province) {
                const city = address.city || address.state || address.province;
                if (!fullAddressParts.includes(city)) fullAddressParts.push(city);
            }
            fullAddressParts.push('Türkiye');

            const fullAddress = [...new Set(fullAddressParts)].join(', ');

            return {
                id: `${item.place_id}-${index}`,
                title,
                subtitle,
                fullAddress: fullAddress || item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                type,
                category,
                importance: item.importance || 0,
                class: itemClass,
                osmType: itemType
            };
        });

        // Sıralama: Arama terimiyle tam eşleşenler önce, sonra relevance'a göre
        const lowerQuery = query.toLowerCase();
        results.sort((a, b) => {
            // Tam eşleşme kontrolü
            const aExact = a.title.toLowerCase() === lowerQuery ? 1 : 0;
            const bExact = b.title.toLowerCase() === lowerQuery ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;

            // Başlangıç eşleşmesi
            const aStarts = a.title.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
            const bStarts = b.title.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            // Tip önceliği: POI ve sokaklar önce
            const typeOrder = { poi: 0, building: 1, street: 2, neighborhood: 3, district: 4, city: 5, place: 6 };
            const typeDiff = (typeOrder[a.type] || 6) - (typeOrder[b.type] || 6);
            if (typeDiff !== 0) return typeDiff;

            // Importance'a göre
            return b.importance - a.importance;
        });

        // Duplikatları kaldır
        const uniqueResults = [];
        const seen = new Set();
        for (const result of results) {
            const key = `${result.title.toLowerCase()}-${result.type}-${result.subtitle.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueResults.push(result);
            }
        }

        console.log(`✅ Found ${uniqueResults.length} unique results for "${query}"`);
        console.log(`   Types: POI=${uniqueResults.filter(r => r.type === 'poi').length}, ` +
            `Building=${uniqueResults.filter(r => r.type === 'building').length}, ` +
            `Street=${uniqueResults.filter(r => r.type === 'street').length}, ` +
            `Neighborhood=${uniqueResults.filter(r => r.type === 'neighborhood').length}`);

        res.json(uniqueResults.slice(0, 20));
    } catch (error) {
        console.error('❌ Location search error:', error.message);
        res.status(500).json({ error: 'Konum araması başarısız', details: error.message });
    }
});

// Koordinatlardan adres al (Reverse Geocoding)
app.get('/api/location/reverse', authenticateToken, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Koordinatlar gerekli' });
        }

        console.log('📍 Reverse geocoding:', lat, lon);

        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                lat,
                lon,
                format: 'json',
                addressdetails: 1,
                'accept-language': 'tr',
                zoom: 18
            },
            headers: {
                'User-Agent': 'TarimZeka-App/1.0 (Agricultural Mobile Application)'
            },
            timeout: 10000
        });

        const data = response.data;
        const address = data.address || {};

        // Düzgün adres formatı oluştur
        const addressParts = [];
        if (address.road) addressParts.push(address.road);
        if (address.house_number) addressParts.push(`No: ${address.house_number}`);
        if (address.neighbourhood) addressParts.push(address.neighbourhood);
        if (address.suburb && address.suburb !== address.neighbourhood) {
            addressParts.push(address.suburb);
        }
        if (address.village || address.town) {
            addressParts.push(address.village || address.town);
        }
        if (address.county) addressParts.push(address.county);
        if (address.city || address.state || address.province) {
            const city = address.city || address.state || address.province;
            if (!addressParts.includes(city)) {
                addressParts.push(city);
            }
        }

        const formattedAddress = addressParts.length > 0
            ? addressParts.join(', ')
            : data.display_name || `${lat}, ${lon}`;

        console.log('✅ Reverse geocode result:', formattedAddress);

        res.json({
            address: formattedAddress,
            fullAddress: data.display_name,
            details: {
                road: address.road,
                houseNumber: address.house_number,
                neighborhood: address.neighbourhood || address.suburb,
                village: address.village,
                town: address.town,
                district: address.county,
                city: address.city || address.state || address.province,
                country: address.country,
                postcode: address.postcode
            }
        });
    } catch (error) {
        console.error('❌ Reverse geocoding error:', error.message);
        res.status(500).json({ error: 'Adres bulunamadı', details: error.message });
    }
});

// ============ WEATHER ROUTES ============

app.get('/api/weather/current', authenticateToken, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Konum bilgisi gerekli' });
        }

        // Check cache first
        const cacheKey = `${lat},${lon}`;
        const cached = await prisma.weatherCache.findUnique({
            where: { location: cacheKey }
        });

        const now = new Date();
        if (cached && (now - new Date(cached.updatedAt)) < 1800000) { // 30 dakika
            return res.json(cached);
        }

        // Fetch from OpenWeatherMap
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
            forecast: forecastRes.data.list.slice(0, 40) // 5 günlük (8 reading/day)
        };

        // Update cache
        const updated = await prisma.weatherCache.upsert({
            where: { location: cacheKey },
            update: weatherData,
            create: weatherData
        });

        res.json(updated);
    } catch (error) {
        console.error('Weather API error:', error);
        res.status(500).json({ error: 'Hava durumu alınamadı' });
    }
});

// ============ FIELD ROUTES ============

// Create field
app.post('/api/fields', authenticateToken, async (req, res) => {
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

        // Create initial irrigation schedule
        await createIrrigationSchedule(field.id, cropType, soilType, latitude, longitude);

        res.json(field);
    } catch (error) {
        console.error('Field creation error:', error);
        res.status(500).json({ error: 'Tarla eklenemedi' });
    }
});

// Get all fields
app.get('/api/fields', authenticateToken, async (req, res) => {
    try {
        const fields = await prisma.field.findMany({
            where: { userId: req.user.userId },
            include: {
                schedules: {
                    where: {
                        date: {
                            gte: new Date()
                        },
                        status: 'pending'
                    },
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
        console.error('Get fields error:', error);
        res.status(500).json({ error: 'Tarlalar getirilemedi' });
    }
});

// Get single field
app.get('/api/fields/:id', authenticateToken, async (req, res) => {
    try {
        const field = await prisma.field.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.userId
            },
            include: {
                soilAnalyses: {
                    orderBy: { analysisDate: 'desc' }
                },
                schedules: {
                    orderBy: { date: 'desc' },
                    take: 30
                }
            }
        });

        if (!field) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        res.json(field);
    } catch (error) {
        console.error('Get field error:', error);
        res.status(500).json({ error: 'Tarla bilgisi alınamadı' });
    }
});

// Update field
app.put('/api/fields/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, latitude, longitude, soilType, cropType, area } = req.body;

        if (!name || !cropType) {
            return res.status(400).json({ error: 'Tarla adı ve ürün türü zorunludur' });
        }

        // Önce tarlanın bu kullanıcıya ait olduğunu kontrol et
        const existingField = await prisma.field.findFirst({
            where: {
                id: id,
                userId: req.user.userId
            }
        });

        if (!existingField) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        const updatedField = await prisma.field.update({
            where: { id: id },
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

        res.json(updatedField);
    } catch (error) {
        console.error('Update field error:', error);
        res.status(500).json({ error: 'Tarla güncellenemedi' });
    }
});

// Delete field
app.delete('/api/fields/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Önce tarlanın bu kullanıcıya ait olduğunu kontrol et
        const existingField = await prisma.field.findFirst({
            where: {
                id: id,
                userId: req.user.userId
            }
        });

        if (!existingField) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        // İlişkili verileri sil
        await prisma.irrigationSchedule.deleteMany({ where: { fieldId: id } });
        await prisma.irrigationLog.deleteMany({ where: { fieldId: id } });
        await prisma.soilAnalysis.deleteMany({ where: { fieldId: id } });

        // Tarlayı sil
        await prisma.field.delete({ where: { id: id } });

        res.json({ message: 'Tarla silindi' });
    } catch (error) {
        console.error('Delete field error:', error);
        res.status(500).json({ error: 'Tarla silinemedi' });
    }
});

// ============ SOIL ANALYSIS ROUTES ============

// Gelişmiş Toprak Analizi
app.post('/api/soil-analysis', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        console.log('🌱 Starting soil analysis...');
        console.log('👤 User ID:', req.user?.userId);
        console.log('📁 File received:', req.file ? '✅ Yes' : '❌ No');

        if (!req.file) {
            console.error('❌ No file uploaded');
            return res.status(400).json({ error: 'No image file provided' });
        }

        // ✅ fieldId al (FormData ile gelirse)
        let { fieldId } = req.body;

        // fieldId yoksa, kullanıcının en son tarlasını bul
        if (!fieldId) {
            const latestField = await prisma.field.findFirst({
                where: { userId: req.user.userId },
                orderBy: { createdAt: 'desc' },
                select: { id: true }
            });

            if (!latestField) {
                return res.status(400).json({
                    error: 'Field required',
                    details: 'Önce bir tarla ekleyin.'
                });
            }

            fieldId = latestField.id;
        }

        console.log('📌 Using fieldId:', fieldId);

        // Cloudinary upload
        const cloudinaryResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'tarimzeka/soil-analysis' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        console.log('📸 Image uploaded:', cloudinaryResult.secure_url);

        // OpenAI API call - İNGİLİZCE PROMPT
        console.log('🤖 Calling OpenAI Vision API...');
        console.log('🔑 API Key exists:', !!process.env.OPENAI_API_KEY);

        const apiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `
Sen bir toprak analizi asistanısın. Görseli analiz et ve SADECE aşağıdaki şemaya uyan geçerli bir JSON döndür.
Markdown kullanma. Ek açıklama ekleme. TÜM metin alanları Türkçe olmalı.

{
  "soilType": "string",              // örn: "kumlu", "killi", "tınlı"
  "soilColor": "string",             // örn: "koyu kahverengi"
  "moistureLevel": "string",         // örn: "düşük", "orta", "yüksek"
  "moisturePercentage": number,
  "organicMatter": {
    "level": "string",
    "percentage": number,
    "description": "string"
  },
  "structure": {
    "type": "string",
    "quality": "string",
    "description": "string"
  },
  "texture": {
    "class": "string",
    "sandPercentage": number,
    "clayPercentage": number,
    "siltPercentage": number
  },
  "drainage": {
    "status": "string",
    "description": "string"
  },
  "ph": {
    "estimated": number,
    "status": "string",
    "description": "string"
  },
  "nutrients": {
    "nitrogen": "string",
    "phosphorus": "string",
    "potassium": "string",
    "description": "string"
  },
  "irrigation": {
    "currentNeed": "string",
    "recommendedMethod": "string",
    "frequency": "string",
    "amount": "string",
    "bestTime": "string",
    "warnings": ["string"]
  },
  "fertilization": {
    "needed": boolean,
    "recommendations": [
      {
        "type": "string",
        "product": "string",
        "amount": "string",
        "timing": "string",
        "method": "string"
      }
    ],
    "organicOptions": ["string"]
  },
  "suitableCrops": {
    "excellent": [{"name": "string", "reason": "string", "tips": "string"}],
    "good": [{"name": "string", "reason": "string", "precautions": "string"}],
    "notRecommended": [{"name": "string", "reason": "string"}]
  },
  "soilImprovement": {
    "shortTerm": ["string"],
    "longTerm": ["string"],
    "priority": "string"
  },
  "problems": [
    {
      "type": "string",
      "severity": "string",
      "description": "string",
      "solution": "string"
    }
  ],
  "overallScore": {
    "value": number,
    "label": "string",
    "summary": "string"
  },
  "confidence": number,
  "additionalNotes": "string"
}
`
                            },
                            {
                                type: 'image_url',
                                image_url: { url: cloudinaryResult.secure_url }
                            }
                        ]
                    }
                ],
                max_tokens: 1200
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ AI Response received');

        const content = apiResponse.data.choices[0].message.content;
        console.log('📝 Content preview:', content.substring(0, 150));

        // Parse JSON - Markdown code blocks'u temizle
        let analysis;
        try {
            let cleanContent = content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            console.log('📝 Cleaned content preview:', cleanContent.substring(0, 100));

            analysis = JSON.parse(cleanContent);
            console.log('✅ JSON parsed successfully');
        } catch (parseError) {
            console.error('❌ JSON Parse Error:', parseError.message);
            console.error('📝 Full content:', content);

            return res.status(500).json({
                error: 'Failed to parse AI response',
                details: parseError.message,
                rawContent: content.substring(0, 300)
            });
        }

        if (!analysis || typeof analysis !== 'object') {
            return res.status(500).json({ error: 'Invalid analysis structure' });
        }

        // ✅ Tüm metinlerde ilk harfi büyük yap
        analysis = deepCapitalizeTr(analysis);

        // ✅ Zorunlu alanları güvenli şekilde doldur
        const soilType = analysis.soilType || 'Unknown';
        const soilQuality = analysis.soilQuality || 'Unknown';
        const moistureLevel = analysis.moistureLevel || 'Unknown';
        const waterManagement =
            typeof analysis.waterManagement === 'string'
                ? analysis.waterManagement
                : JSON.stringify(analysis.waterManagement || { recommendation: 'N/A' });

        // ✅ recommendedCrops zorunlu (String[])
        const recommendedCrops = Array.isArray(analysis.suitableCrops)
            ? analysis.suitableCrops
            : Array.isArray(analysis.recommendedCrops)
                ? analysis.recommendedCrops
                : [];

        const soilAnalysis = await prisma.soilAnalysis.create({
            data: {
                fieldId, // ✅ userId KULLANMA
                imageUrl: cloudinaryResult.secure_url,
                soilType,
                soilQuality,
                moistureLevel,
                waterManagement,
                recommendedCrops,
                ph: typeof analysis.pH === 'number' ? analysis.pH : null,
                organicMatter: typeof analysis.organicMatterContent === 'number' ? analysis.organicMatterContent : null,
                aiResponse: JSON.stringify(analysis),
                analysisDate: new Date()
            }
        });

        res.json({
            success: true,
            id: soilAnalysis.id,
            imageUrl: soilAnalysis.imageUrl,
            aiResponse: analysis,
            analysisDate: soilAnalysis.analysisDate
        });
    } catch (error) {
        console.error('❌ Soil analysis error:', error.message);
        res.status(500).json({ error: 'Soil analysis failed', message: error.message });
    }
});

// Analiz geçmişi
app.get('/api/soil-analysis/history', authenticateToken, async (req, res) => {
    try {
        const { fieldId } = req.query;

        let where = {};

        if (fieldId) {
            where.fieldId = fieldId;
        } else {
            // Kullanıcının tüm tarlalarına ait analizler
            const userFields = await prisma.field.findMany({
                where: { userId: req.user.userId },
                select: { id: true }
            });

            if (userFields.length > 0) {
                where.fieldId = { in: userFields.map(f => f.id) };
            } else {
                // Kullanıcının tarlası yoksa, fieldId null olanları getir
                where.fieldId = null;
            }
        }

        const analyses = await prisma.soilAnalysis.findMany({
            where,
            orderBy: { analysisDate: 'desc' },
            take: 20,
            include: {
                field: {
                    select: { name: true, cropType: true, location: true }
                }
            }
        });

        res.json(analyses.map(a => ({
            ...a,
            aiResponse: a.aiResponse ? JSON.parse(a.aiResponse) : null,
            waterManagement: a.waterManagement ? JSON.parse(a.waterManagement) : null
        })));

    } catch (error) {
        console.error('Get analysis history error:', error);
        res.status(500).json({ error: 'Analiz geçmişi alınamadı' });
    }
});

// Tek analiz detayı
app.get('/api/soil-analysis/:id', authenticateToken, async (req, res) => {
    try {
        const analysis = await prisma.soilAnalysis.findUnique({
            where: { id: req.params.id },
            include: {
                field: {
                    select: { name: true, cropType: true, location: true }
                }
            }
        });

        if (!analysis) {
            return res.status(404).json({ error: 'Analiz bulunamadı' });
        }

        res.json({
            ...analysis,
            aiResponse: analysis.aiResponse ? JSON.parse(analysis.aiResponse) : null,
            waterManagement: analysis.waterManagement ? JSON.parse(analysis.waterManagement) : null
        });

    } catch (error) {
        console.error('Get analysis error:', error);
        res.status(500).json({ error: 'Analiz bilgisi alınamadı' });
    }
});

// ============ IRRIGATION ROUTES ============

// Get irrigation schedule
app.get('/api/irrigation/schedule', authenticateToken, async (req, res) => {
    try {
        const { fieldId, startDate, endDate, view } = req.query;

        let dateFilter = {};
        if (view === 'week') {
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 7);
            dateFilter = { gte: start, lte: end };
        } else if (view === 'month') {
            const start = new Date();
            const end = new Date();
            end.setMonth(end.getMonth() + 1);
            dateFilter = { gte: start, lte: end };
        } else if (startDate && endDate) {
            dateFilter = { gte: new Date(startDate), lte: new Date(endDate) };
        }

        const schedules = await prisma.irrigationSchedule.findMany({
            where: {
                fieldId,
                date: dateFilter
            },
            include: {
                field: true
            },
            orderBy: { date: 'asc' }
        });

        res.json(schedules);
    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({ error: 'Takvim getirilemedi' });
    }
});

// Complete irrigation
app.post('/api/irrigation/complete', authenticateToken, async (req, res) => {
    try {
        const { scheduleId, waterUsed, duration, notes } = req.body;

        const schedule = await prisma.irrigationSchedule.findUnique({
            where: { id: scheduleId },
            include: { field: true }
        });

        if (!schedule) {
            return res.status(404).json({ error: 'Sulama planı bulunamadı' });
        }

        // Update schedule status
        await prisma.irrigationSchedule.update({
            where: { id: scheduleId },
            data: { status: 'completed' }
        });

        // Create irrigation log
        const log = await prisma.irrigationLog.create({
            data: {
                fieldId: schedule.fieldId,
                scheduledDate: schedule.date,
                waterUsed: waterUsed || schedule.waterAmount * (schedule.field.area || 100),
                duration,
                notes
            }
        });

        // Calculate and save water savings
        const recommendedWater = schedule.waterAmount * (schedule.field.area || 100);
        const actualWater = waterUsed || recommendedWater;
        const saved = Math.max(0, recommendedWater * 1.5 - actualWater);

        if (saved > 0) {
            await prisma.saving.create({
                data: {
                    userId: req.user.userId,
                    waterSaved: saved,
                    savingRate: (saved / (recommendedWater * 1.5)) * 100,
                    comparison: recommendedWater * 1.5
                }
            });
        }

        res.json({ log, message: 'Sulama kaydedildi' });
    } catch (error) {
        console.error('Complete irrigation error:', error);
        res.status(500).json({ error: 'Sulama kaydedilemedi' });
    }
});

// ============ SAVINGS ROUTES ============

app.get('/api/savings/stats', authenticateToken, async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        let startDate = new Date();
        if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (period === 'year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        }

        const savings = await prisma.saving.findMany({
            where: {
                userId: req.user.userId,
                date: { gte: startDate }
            },
            orderBy: { date: 'desc' }
        });

        const totalSaved = savings.reduce((sum, s) => sum + s.waterSaved, 0);
        const avgRate = savings.length > 0
            ? savings.reduce((sum, s) => sum + s.savingRate, 0) / savings.length
            : 0;

        // Weekly breakdown
        const weeklyData = {};
        savings.forEach(s => {
            const week = getWeekNumber(s.date);
            if (!weeklyData[week]) weeklyData[week] = 0;
            weeklyData[week] += s.waterSaved;
        });

        res.json({
            totalSaved,
            averageSavingRate: avgRate,
            savingsCount: savings.length,
            weeklyData,
            recentSavings: savings.slice(0, 10),
            environmentalImpact: {
                peopleEquivalent: Math.round(totalSaved / 50),
                treesEquivalent: Math.round(totalSaved / 200)
            }
        });
    } catch (error) {
        console.error('Get savings error:', error);
        res.status(500).json({ error: 'İstatistikler alınamadı' });
    }
});

// ============ NOTIFICATION ROUTES ============

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Bildirimler getirilemedi' });
    }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const notification = await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true }
        });

        res.json(notification);
    } catch (error) {
        console.error('Update notification error:', error);
        res.status(500).json({ error: 'Bildirim güncellenemedi' });
    }
});

// ============ USER ROUTES ============

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                location: true,
                createdAt: true,
                _count: {
                    select: {
                        fields: true,
                        notifications: true,
                        savings: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Profil bilgisi alınamadı' });
    }
});

// Update user profile
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, location } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { name, phone, location },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                location: true
            }
        });

        res.json(updatedUser);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Profil güncellenemedi' });
    }
});

// ============ HELPER FUNCTIONS ============

async function analyzeSoilWithAI(imageUrl, location, weatherData) {
    const prompt = `Sen bir toprak analizi asistanısın. Görseli analiz et ve SADECE aşağıdaki şemaya uyan geçerli bir JSON döndür.
Markdown kullanma. Ek açıklama ekleme. TÜM metin alanları Türkçe olmalı.
⚠️ Tüm cümle ve ifadelerin ilk harfi büyük olmalı.

{
  "soilType": "string",              // örn: "kumlu", "killi", "tınlı"
  "soilColor": "string",             // örn: "koyu kahverengi"
  "moistureLevel": "string",         // örn: "düşük", "orta", "yüksek"
  "moisturePercentage": number,
  "organicMatter": {
    "level": "string",
    "percentage": number,
    "description": "string"
  },
  "structure": {
    "type": "string",
    "quality": "string",
    "description": "string"
  },
  "texture": {
    "class": "string",
    "sandPercentage": number,
    "clayPercentage": number,
    "siltPercentage": number
  },
  "drainage": {
    "status": "string",
    "description": "string"
  },
  "ph": {
    "estimated": number,
    "status": "string",
    "description": "string"
  },
  "nutrients": {
    "nitrogen": "string",
    "phosphorus": "string",
    "potassium": "string",
    "description": "string"
  },
  "irrigation": {
    "currentNeed": "string",
    "recommendedMethod": "string",
    "frequency": "string",
    "amount": "string",
    "bestTime": "string",
    "warnings": ["string"]
  },
  "fertilization": {
    "needed": boolean,
    "recommendations": [
      {
        "type": "string",
        "product": "string",
        "amount": "string",
        "timing": "string",
        "method": "string"
      }
    ],
    "organicOptions": ["string"]
  },
  "suitableCrops": {
    "excellent": [{"name": "string", "reason": "string", "tips": "string"}],
    "good": [{"name": "string", "reason": "string", "precautions": "string"}],
    "notRecommended": [{"name": "string", "reason": "string"}]
  },
  "soilImprovement": {
    "shortTerm": ["string"],
    "longTerm": ["string"],
    "priority": "string"
  },
  "problems": [
    {
      "type": "string",
      "severity": "string",
      "description": "string",
      "solution": "string"
    }
  ],
  "overallScore": {
    "value": number,
    "label": "string",
    "summary": "string"
  },
  "confidence": number,
  "additionalNotes": "string"
}
`;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: imageUrl } }
                        ]
                    }
                ],
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const content = response.data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

        return {
            ...analysis,
            fullResponse: content
        };
    } catch (error) {
        console.error('OpenAI API error:', error);
        // Fallback basic analysis
        return {
            soilType: 'tınlı',
            soilQuality: 'Orta',
            moistureLevel: 'Orta',
            ph: 7.0,
            organicMatter: 2.5,
            waterManagement: 'Düzenli sulama önerilir. Toprak nemini kontrol edin.',
            recommendedCrops: ['buğday', 'arpa', 'mercimek'],
            fullResponse: 'Otomatik analiz yapıldı.'
        };
    }
}

async function createIrrigationSchedule(fieldId, cropType, soilType, lat, lon) {
    try {
        // Get 7-day weather forecast
        const weatherData = await getWeatherForLocation(`${lat},${lon}`);

        const schedules = [];
        const today = new Date();

        // Water needs based on crop type (L/m² per day)
        const waterNeeds = {
            'buğday': 4,
            'domates': 6,
            'pamuk': 7,
            'mercimek': 3,
            'arpa': 3.5,
            'mısır': 6,
            'patates': 5,
            'soğan': 4,
            'biber': 5.5,
            'salatalık': 6
        };

        const baseWater = waterNeeds[cropType?.toLowerCase()] || 5;

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);

            const forecastDay = weatherData?.forecast?.[i * 8] || {};
            const temp = forecastDay.main?.temp || 25;
            const humidity = forecastDay.main?.humidity || 50;
            const rain = forecastDay.rain?.['3h'] || 0;

            // Calculate water amount based on weather
            let waterAmount = baseWater;

            // Adjust for temperature
            if (temp > 30) waterAmount *= 1.3;
            else if (temp > 25) waterAmount *= 1.1;
            else if (temp < 15) waterAmount *= 0.8;

            // Adjust for humidity
            if (humidity < 40) waterAmount *= 1.2;
            else if (humidity > 70) waterAmount *= 0.8;

            // Adjust for soil type
            if (soilType === 'kumlu') waterAmount *= 1.2;
            else if (soilType === 'killi') waterAmount *= 0.9;

            // Skip if rain expected
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
    } catch (error) {
        console.error('Create irrigation schedule error:', error);
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
        console.error('Get weather error:', error);
        return null;
    }
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ✅ Türkçe ilk harfi büyütme (tüm stringler için)
const capitalizeTr = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const first = trimmed[0].toLocaleUpperCase('tr-TR');
    return first + trimmed.slice(1);
};

const deepCapitalizeTr = (obj) => {
    if (Array.isArray(obj)) return obj.map(deepCapitalizeTr);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = deepCapitalizeTr(v);
        }
        return out;
    }
    return capitalizeTr(obj);
};

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'TarımZeka API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ============ 404 HANDLER ============

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Sunucu hatası', details: err.message });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 TarımZeka API running on port ${PORT}`);
    console.log(`📍 Location search: /api/location/search`);
    console.log(`📍 Reverse geocoding: /api/location/reverse`);
    console.log(`🌤️ Weather: /api/weather/current`);
    console.log(`🌾 Fields: /api/fields`);
    console.log(`💧 Irrigation: /api/irrigation/schedule`);
});