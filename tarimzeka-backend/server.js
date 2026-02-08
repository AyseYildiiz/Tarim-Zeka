require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
const APP_URL = process.env.APP_URL || 'tarimzekamobile://reset-password';

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

const createResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const getMailTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
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

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'E-posta gerekli' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.json({ message: 'Eğer hesap varsa link gönderildi' });
        }

        const token = createResetToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
        });

        const transporter = getMailTransporter();
        const fromAddress = process.env.SMTP_FROM || 'no-reply@tarimzeka.com';

        if (transporter) {
            const subject = 'TarimZeka - Sifre Sifirlama';
            const text = [
                'Sifrenizi yenilemek icin asagidaki kodu uygulamada kullanin:',
                token,
                '',
                'Kodu kopyalayip uygulamaya yapistirin.',
                '',
                'Kod 30 dakika gecerlidir.'
            ].join('\n');

            const html = `
<!doctype html>
<html>
    <body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 12px 0;color:#111827;">TarimZeka Sifre Sifirlama</h2>
                <p style="margin:0 0 16px 0;color:#374151;">
                    Sifrenizi yenilemek icin asagidaki kodu uygulamada kullanin.
                </p>
                <div style="background:#f3f4f6;border-radius:10px;padding:12px 16px;display:block;max-width:100%;">
                    <span style="font-family:Courier New,Courier,monospace;font-size:16px;color:#111827;word-break:break-all;line-height:1.4;display:block;text-align:center;">${token}</span>
                </div>
                <p style="margin:12px 0 0 0;color:#6b7280;font-size:13px;">
                    Kodu kopyalayip uygulamaya yapistirin.
                </p>
                <p style="margin:16px 0 0 0;color:#9ca3af;font-size:12px;">Kod 30 dakika gecerlidir.</p>
            </div>
        </div>
    </body>
</html>`;

            await transporter.sendMail({
                from: fromAddress,
                to: user.email,
                subject,
                text,
                html,
            });
        } else {
            console.warn('SMTP ayarlari eksik. Reset kodu:', token);
        }

        return res.json({ message: 'Eğer hesap varsa link gönderildi' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Sifre sifirlama basarisiz' });
    }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token ve yeni sifre gerekli' });
        }

        const tokenHash = hashToken(token);
        const resetRecord = await prisma.passwordReset.findUnique({
            where: { tokenHash },
        });

        if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Token gecersiz veya suresi dolmus' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: resetRecord.userId },
            data: { password: hashedPassword },
        });

        await prisma.passwordReset.update({
            where: { id: resetRecord.id },
            data: { usedAt: new Date() },
        });

        return res.json({ message: 'Sifre guncellendi' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Sifre sifirlama basarisiz' });
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

// Get 7-day weather forecast with AI irrigation analysis
app.get('/api/weather/forecast', authenticateToken, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Konum bilgisi gerekli' });
        }

        const apiKey = process.env.OPENWEATHER_API_KEY;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;

        const forecastRes = await axios.get(forecastUrl);

        // 7 günün günlük ortalamasını al
        const dailyForecasts = [];
        const forecastsByDay = {};

        forecastRes.data.list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!forecastsByDay[date]) {
                forecastsByDay[date] = [];
            }
            forecastsByDay[date].push(item);
        });

        Object.entries(forecastsByDay).forEach(([date, items]) => {
            const temps = items.map(i => i.main.temp);
            const humidities = items.map(i => i.main.humidity);
            const rains = items.map(i => i.rain?.['3h'] || 0);

            dailyForecasts.push({
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
            });
        });

        // Check for weather alerts and create notifications
        const userId = req.user.userId;

        // Kullanıcının tarlalarını bul
        const fields = await prisma.field.findMany({
            where: { userId },
            select: { id: true, name: true }
        });

        // Her tarla için hava uyarıları oluştur
        for (const forecast of dailyForecasts) {
            if (forecast.totalRain > 20) {
                // Yağış uyarısı
                for (const field of fields) {
                    await createNotification(
                        userId,
                        'heavy_rain',
                        `🌧️ Ağır Yağış Uyarısı - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.totalRain}mm yağış beklenmektedir. Sulama planınızı gözden geçirin.`,
                        new Date(forecast.date)
                    );
                }
            } else if (forecast.totalRain > 10) {
                // Hafif yağış uyarısı
                for (const field of fields) {
                    await createNotification(
                        userId,
                        'light_rain',
                        `🌤️ Hafif Yağış - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.totalRain}mm yağış beklenmektedir.`,
                        new Date(forecast.date)
                    );
                }
            }

            // Sıcaklık uyarısı (çok yüksek veya çok düşük)
            if (forecast.avgTemp > 35) {
                for (const field of fields) {
                    await createNotification(
                        userId,
                        'high_temp',
                        `🌡️ Yüksek Sıcaklık - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.avgTemp}°C sıcaklık bekleniyor. Sık sulama gerekebilir.`,
                        new Date(forecast.date)
                    );
                }
            } else if (forecast.avgTemp < 5) {
                for (const field of fields) {
                    await createNotification(
                        userId,
                        'low_temp',
                        `❄️ Düşük Sıcaklık - ${field.name}`,
                        `${forecast.date} tarihinde ${forecast.avgTemp}°C sıcaklık bekleniyor. Bitkilerinizi koruyun.`,
                        new Date(forecast.date)
                    );
                }
            }

            // Düşük nem uyarısı
            if (forecast.avgHumidity < 30) {
                for (const field of fields) {
                    await createNotification(
                        userId,
                        'low_humidity',
                        `💨 Düşük Nem - ${field.name}`,
                        `${forecast.date} tarihinde %${forecast.avgHumidity} nem bekleniyor. Daha fazla sulama gerekebilir.`,
                        new Date(forecast.date)
                    );
                }
            }
        }

        res.json({
            forecast: dailyForecasts,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Weather forecast error:', error);
        res.status(500).json({ error: 'Hava durumu tahmini alınamadı' });
    }
});

// Calculate AI-based irrigation schedule for a field
app.post('/api/fields/:fieldId/calculate-irrigation-schedule', authenticateToken, async (req, res) => {
    try {
        const { fieldId } = req.params;

        // Get field
        const field = await prisma.field.findFirst({
            where: {
                id: fieldId,
                userId: req.user.userId
            }
        });

        if (!field) {
            return res.status(404).json({ error: 'Tarla bulunamadı' });
        }

        if (!field.latitude || !field.longitude) {
            return res.status(400).json({ error: 'Tarla konumu ayarlanmalıdır' });
        }

        // Delete only pending schedules (keep completed history)
        await prisma.irrigationSchedule.deleteMany({
            where: {
                fieldId,
                status: 'pending'
            }
        });

        // Create AI-based irrigation schedule
        const schedule = await createAIIrrigationSchedule(
            fieldId,
            field.cropType,
            field.soilType,
            field.latitude,
            field.longitude
        );

        res.json({
            message: 'Sulama takvimi hesaplandı',
            schedule,
            fieldId
        });
    } catch (error) {
        console.error('Calculate irrigation schedule error:', error);
        res.status(500).json({ error: 'Sulama takvimi hesaplanamadı' });
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

        // Create initial irrigation schedule with AI
        await createAIIrrigationSchedule(field.id, cropType, soilType, latitude, longitude);

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
                    orderBy: [
                        { status: 'asc' },  // pending (0) before completed (1)
                        { date: 'desc' }    // newest first within same status
                    ],
                    take: 100  // Increased to ensure we get all pending + recent completed
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

        // Eğer ürün tipi, toprak tipi veya konum değiştiyse sulama takvimini yeniden hesapla
        const shouldRecalculate =
            existingField.cropType !== cropType ||
            existingField.soilType !== soilType ||
            existingField.latitude !== (latitude ? parseFloat(latitude) : null) ||
            existingField.longitude !== (longitude ? parseFloat(longitude) : null);

        if (shouldRecalculate && updatedField.latitude && updatedField.longitude) {
            try {
                // Eski pending schedule'ları sil
                await prisma.irrigationSchedule.deleteMany({
                    where: {
                        fieldId: id,
                        status: 'pending'
                    }
                });

                // Yeni sulama takvimi oluştur
                await createAIIrrigationSchedule(
                    id,
                    updatedField.cropType,
                    updatedField.soilType,
                    updatedField.latitude,
                    updatedField.longitude
                );

                console.log(`Sulama takvimi yeniden hesaplandı: ${updatedField.name}`);
            } catch (scheduleError) {
                console.error('Schedule recalculation error:', scheduleError);
                // Hata olsa bile field update başarılı sayılsın
            }
        }

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
ÖNEMLİ: Önerilen ürünlerde ÇOK KAPSAMLI olmalısın - her kategori için EN AZ 3-4 ürün öner.

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
    "excellent": [
      {"name": "string", "reason": "string", "tips": "string"},
      {"name": "string", "reason": "string", "tips": "string"},
      {"name": "string", "reason": "string", "tips": "string"},
      {"name": "string", "reason": "string", "tips": "string"}
    ],
    "good": [
      {"name": "string", "reason": "string", "precautions": "string"},
      {"name": "string", "reason": "string", "precautions": "string"},
      {"name": "string", "reason": "string", "precautions": "string"},
      {"name": "string", "reason": "string", "precautions": "string"}
    ],
    "notRecommended": [
      {"name": "string", "reason": "string"},
      {"name": "string", "reason": "string"}
    ]
  },
  "soilImprovement": {
    "shortTerm": ["string", "string", "string"],
    "longTerm": ["string", "string", "string"],
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
                max_tokens: 2000
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
            const field = await prisma.field.findFirst({
                where: {
                    id: fieldId,
                    userId: req.user.userId
                },
                select: { id: true }
            });

            if (!field) {
                return res.status(403).json({ error: 'Bu tarla için yetkiniz yok' });
            }

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
                return res.json([]);
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
            aiResponse: a.aiResponse ? safeJsonParse(a.aiResponse) : null,
            waterManagement: a.waterManagement ? safeJsonParse(a.waterManagement) : null
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
                    select: { name: true, cropType: true, location: true, userId: true }
                }
            }
        });

        if (!analysis) {
            return res.status(404).json({ error: 'Analiz bulunamadı' });
        }

        if (!analysis.field || analysis.field.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Bu analiz için yetkiniz yok' });
        }

        res.json({
            ...analysis,
            aiResponse: analysis.aiResponse ? safeJsonParse(analysis.aiResponse) : null,
            waterManagement: analysis.waterManagement ? safeJsonParse(analysis.waterManagement) : null
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
                ...(fieldId ? { fieldId } : {}),
                date: dateFilter,
                field: {
                    userId: req.user.userId
                }
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

// Complete irrigation (alternative route - by schedule ID in path)
app.patch('/api/irrigation/schedule/:scheduleId/complete', authenticateToken, async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { waterUsed, duration, notes } = req.body;

        const schedule = await prisma.irrigationSchedule.findUnique({
            where: { id: scheduleId },
            include: { field: true }
        });

        if (!schedule) {
            return res.status(404).json({ error: 'Sulama planı bulunamadı' });
        }

        // Verify field ownership
        const field = await prisma.field.findFirst({
            where: {
                id: schedule.fieldId,
                userId: req.user.userId
            }
        });

        if (!field) {
            return res.status(403).json({ error: 'Bu tarla için yetkiniz yok' });
        }

        // Update schedule status
        const updatedSchedule = await prisma.irrigationSchedule.update({
            where: { id: scheduleId },
            data: { status: 'completed' }
        });

        const areaM2 = (field.area ?? 1) * 1000;

        // Create irrigation log
        const log = await prisma.irrigationLog.create({
            data: {
                fieldId: schedule.fieldId,
                scheduledDate: schedule.date,
                waterUsed: waterUsed || schedule.waterAmount * areaM2,
                duration,
                notes
            }
        });

        // Calculate and save water savings
        const recommendedWater = schedule.waterAmount * areaM2;
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

        // Create completion notification
        await createNotification(
            req.user.userId,
            'irrigation_completed',
            `✅ Sulama Tamamlandı - ${field.name}`,
            `${field.name} tarlası sulaması tamamlandı. ${actualWater.toFixed(0)}L su kullanıldı.`,
            new Date()
        );

        res.json({
            schedule: updatedSchedule,
            log,
            message: 'Sulama tamamlandı'
        });
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

// Get user's total savings summary
app.get('/api/savings', authenticateToken, async (req, res) => {
    try {
        const savings = await prisma.saving.findMany({
            where: { userId: req.user.userId },
            orderBy: { date: 'desc' }
        });

        let totalSaved = 0;
        let totalWaterSaved = 0;
        let totalFertilizerSaved = 0;
        let totalEnergySaved = 0;

        savings.forEach(s => {
            totalWaterSaved += s.waterSaved || 0;
            // Gübre tasarrufu: Su tasarrufu ile orantılı (~2kg per 100L water saved)
            totalFertilizerSaved += (s.waterSaved || 0) * 0.02;
            // Enerji tasarrufu: Su tasarrufu ile orantılı (~0.5 kWh per 100L water saved)
            totalEnergySaved += (s.waterSaved || 0) * 0.005;
        });

        // Para tasarrufu: Su tasarrufu × 0.05 TL/L + Gübre tasarrufu × 2 TL/kg + Enerji tasarrufu × 3 TL/kWh
        totalSaved = Math.round(
            (totalWaterSaved * 0.05) + (totalFertilizerSaved * 2) + (totalEnergySaved * 3)
        );

        res.json({
            totalSaved: Math.round(totalSaved),
            waterSaved: Math.round(totalWaterSaved),
            fertilizerSaved: Math.round(totalFertilizerSaved * 100) / 100,
            energySaved: Math.round(totalEnergySaved * 100) / 100
        });
    } catch (error) {
        console.error('Get savings error:', error);
        res.status(500).json({
            totalSaved: 0,
            waterSaved: 0,
            fertilizerSaved: 0,
            energySaved: 0
        });
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
        // First verify notification belongs to user
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id }
        });

        if (!notification || notification.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Bu bildirimi güncelleyemezsiniz' });
        }

        const updatedNotification = await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true }
        });

        res.json(updatedNotification);
    } catch (error) {
        console.error('Update notification error:', error);
        res.status(500).json({ error: 'Bildirim güncellenemedi' });
    }
});

// Delete notification
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    try {
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id }
        });

        if (!notification || notification.userId !== req.user.userId) {
            return res.status(403).json({ error: 'Bu bildirimi silemezsiniz' });
        }

        await prisma.notification.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Bildirim silindi' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Bildirim silinemedi' });
    }
});

// Create notification (internal/admin use)
async function createNotification(userId, type, title, message, scheduledFor = null) {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                isRead: false
            }
        });
        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
        return null;
    }
}

// Delete old notifications (older than 30 days)
app.delete('/api/notifications/cleanup/old', authenticateToken, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const deleted = await prisma.notification.deleteMany({
            where: {
                userId: req.user.userId,
                createdAt: { lt: thirtyDaysAgo },
                isRead: true
            }
        });

        res.json({
            message: 'Eski bildirimler silindi',
            deletedCount: deleted.count
        });
    } catch (error) {
        console.error('Cleanup notifications error:', error);
        res.status(500).json({ error: 'Eski bildirimler silinemedi' });
    }
});

// Mark all notifications as read
app.patch('/api/notifications/mark-all/read', authenticateToken, async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.userId, isRead: false },
            data: { isRead: true }
        });

        res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'İşlem başarısız oldu' });
    }
});

// Test notification endpoint (for development)
app.post('/api/notifications/test', authenticateToken, async (req, res) => {
    try {
        const { type, title, message } = req.body;

        const notification = await createNotification(
            req.user.userId,
            type || 'test',
            title || '📧 Test Bildirimi',
            message || 'Bu bir test bildirimidir.',
            new Date()
        );

        res.json({
            message: 'Test bildirimi oluşturuldu',
            notification
        });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ error: 'Test bildirimi oluşturulamadı' });
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

// Change password
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
        }

        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Mevcut şifre yanlış' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { id: req.user.userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Şifre başarıyla değiştirildi' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Şifre değiştirilemedi' });
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
  "waterMin": number,  // L/m² per irrigation
  "waterMax": number,  // L/m² per irrigation
  "intervalDays": number, // 1-10
  "recommendedTimeRange": "HH:MM-HH:MM"
}

const normalizeTrKey = (value) => {
    if (!value) return '';
    return value
        .toString()
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/\u0307/g, '')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u');
};

const normalizeMapKeys = (map) => {
    const out = {};
    Object.entries(map).forEach(([key, value]) => {
        out[normalizeTrKey(key)] = value;
    });
    return out;
};
Be conservative, realistic for field irrigation. If rain is high, use lower waterMin/Max but keep above 0.5 unless irrigation not needed.
`;

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
        console.error('AI water profile error:', error?.response?.data || error.message);
        return null;
    }
}

async function createAIIrrigationSchedule(fieldId, cropType, soilType, lat, lon) {
    try {
        // Fetch real-time weather data
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

        // AI için crop profilleri
        const cropProfiles = {
            // Tahıllar
            'buğday': { waterMin: 3, waterMax: 5, tempOptimal: 20, tempMin: 0, tempMax: 30, humidityOptimal: 45 },
            'arpa': { waterMin: 3, waterMax: 5, tempOptimal: 18, tempMin: 0, tempMax: 28, humidityOptimal: 45 },
            'çavdar': { waterMin: 2.5, waterMax: 4.5, tempOptimal: 18, tempMin: -5, tempMax: 28, humidityOptimal: 40 },
            'mercimek': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 40 },
            'nohut': { waterMin: 2, waterMax: 3.5, tempOptimal: 20, tempMin: 5, tempMax: 32, humidityOptimal: 35 },

            // Sebzeler
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

            // Meyveler
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

            // Yağlı tohumlar
            'ayçiçeği': { waterMin: 3.5, waterMax: 5.5, tempOptimal: 22, tempMin: 10, tempMax: 32, humidityOptimal: 45 },
            'kanola': { waterMin: 2.5, waterMax: 4, tempOptimal: 18, tempMin: 5, tempMax: 28, humidityOptimal: 45 },
            'susam': { waterMin: 3, waterMax: 5, tempOptimal: 26, tempMin: 18, tempMax: 35, humidityOptimal: 40 },

            // Endüstriyel ürünler
            'pamuk': { waterMin: 6, waterMax: 8, tempOptimal: 26, tempMin: 18, tempMax: 38, humidityOptimal: 50 },
            'iplik bitkileri': { waterMin: 4, waterMax: 6, tempOptimal: 22, tempMin: 12, tempMax: 32, humidityOptimal: 45 },

            // Bahçe ve Diğer
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
            'kumlu': 1.3,      // Kum suyu hızlı kaybediyor
            'killi': 0.8,      // Kil suyu daha iyi tuttuğu için daha az su
            'tınlı': 1.0,      // Tınlı dengeleme
            'balçık': 0.85,    // Balçık kil gibi
            'çakıllı': 1.4     // Çakıllı daha hızlı kuruyor
        };

        const normalizedCropProfiles = normalizeMapKeys(cropProfiles);
        const normalizedSoilMultipliers = normalizeMapKeys(soilMultipliers);
        const cropKey = normalizeTrKey(cropType);
        const soilKey = normalizeTrKey(soilType);

        const cropProfile = normalizedCropProfiles[cropKey]
            || normalizedCropProfiles[normalizeTrKey('buğday')];
        const soilMultiplier = normalizedSoilMultipliers[soilKey] || 1.0;

        const aiProfile = await getAIWaterProfile({
            cropType,
            soilType,
            lat,
            lon,
            month: new Date().getMonth() + 1,
            forecastSummary: {
                avgTemp: avgTempAll,
                avgHumidity: avgHumidityAll,
                totalRain: totalRainAll
            }
        });

        const effectiveProfile = {
            ...cropProfile,
            waterMin: aiProfile?.waterMin ?? cropProfile.waterMin,
            waterMax: aiProfile?.waterMax ?? cropProfile.waterMax
        };

        // Determine irrigation interval based on crop type (in days)
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

        const normalizedIntervals = normalizeMapKeys(irrigationIntervals);
        const irrigationInterval = aiProfile?.intervalDays
            || normalizedIntervals[cropKey]
            || 3;

        // Create schedules for next 14 days with irrigation interval
        const schedules = [];
        for (let i = 0; i < 14; i += irrigationInterval) {
            const scheduleDay = new Date();
            scheduleDay.setDate(scheduleDay.getDate() + i);
            scheduleDay.setHours(0, 0, 0, 0);

            // Find matching forecast day for this schedule
            let avgTemp = cropProfile.tempOptimal;
            let avgHumidity = cropProfile.humidityOptimal;
            let totalRain = 0;
            let weatherCondition = 'Açık';

            // Match with forecast if available
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

            // Calculate water amount based on multiple factors
            // 1. Base water need (L/m²) - crop specific
            let baseWater = (effectiveProfile.waterMin + effectiveProfile.waterMax) / 2;

            // 2. Temperature adjustment (hotter = more water)
            const tempDiff = Math.abs(avgTemp - effectiveProfile.tempOptimal);
            let tempFactor = 1.0;
            if (avgTemp > effectiveProfile.tempOptimal) {
                // Sıcak hava - daha fazla su
                tempFactor = 1 + Math.min(tempDiff / 10, 0.5); // Max %50 artış
            } else if (avgTemp < effectiveProfile.tempOptimal) {
                // Soğuk hava - daha az su
                tempFactor = 1 - Math.min(tempDiff / 20, 0.3); // Max %30 azalma
            }

            // 3. Humidity adjustment (lower humidity = more water)
            let humidityFactor = 1.0;
            if (avgHumidity < effectiveProfile.humidityOptimal) {
                // Düşük nem - daha fazla su
                const humidityDiff = effectiveProfile.humidityOptimal - avgHumidity;
                humidityFactor = 1 + Math.min(humidityDiff / 100, 0.4); // Max %40 artış
            } else {
                // Yüksek nem - daha az su
                const humidityDiff = avgHumidity - effectiveProfile.humidityOptimal;
                humidityFactor = 1 - Math.min(humidityDiff / 150, 0.2); // Max %20 azalma
            }

            // 4. Apply all factors
            let waterAmount = baseWater * tempFactor * humidityFactor * soilMultiplier;

            // 5. Rain adjustment - significant reduction for rain
            if (totalRain > 15) {
                // Çok yağmur - sulama gereksiz
                waterAmount = 0;
            } else if (totalRain > 10) {
                // Yoğun yağmur - %80 azalma
                waterAmount *= 0.2;
            } else if (totalRain > 5) {
                // Orta yağmur - %50 azalma
                waterAmount *= 0.5;
            } else if (totalRain > 2) {
                // Hafif yağmur - %30 azalma
                waterAmount *= 0.7;
            }

            // 6. Season adjustment (basit - daha gelişmiş olabilir)
            const month = scheduleDay.getMonth();
            if (month >= 5 && month <= 8) {
                // Yaz ayları (Haziran-Eylül) - %20 artış
                waterAmount *= 1.2;
            } else if (month >= 11 || month <= 2) {
                // Kış ayları (Aralık-Mart) - %20 azalma
                waterAmount *= 0.8;
            }

            waterAmount = Math.max(0, Math.round(waterAmount * 10) / 10);

            // Determine recommended time based on temperature and humidity
            let recommendedTime = aiProfile?.recommendedTimeRange || '06:00-08:00';
            if (avgTemp > 30) {
                recommendedTime = '04:30-06:30'; // Çok sıcak - çok erken
            } else if (avgTemp > 28) {
                recommendedTime = '05:00-07:00'; // Sıcak - erken sabah
            } else if (avgTemp > 24) {
                recommendedTime = '06:00-08:00'; // Normal - sabah
            } else if (avgTemp > 18) {
                recommendedTime = '07:00-09:00'; // Ilık - geç sabah
            } else if (avgTemp < 12) {
                recommendedTime = '10:00-12:00'; // Soğuk - öğlen
            } else {
                recommendedTime = '08:00-10:00'; // Serin - orta sabah
            }

            // Create detailed note
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

            // Get field to get userId
            const field = await prisma.field.findUnique({
                where: { id: fieldId },
                select: { userId: true, name: true }
            });

            if (field) {
                // Create notifications for first 3 irrigation schedules (only if water is needed)
                const firstNotifications = schedules.slice(0, 3).filter(s => s.waterAmount > 0);

                for (const schedule of firstNotifications) {
                    const scheduleDate = new Date(schedule.date);
                    const dateStr = scheduleDate.toLocaleDateString('tr-TR', {
                        month: 'short',
                        day: 'numeric'
                    });

                    await createNotification(
                        field.userId,
                        'irrigation',
                        `⏰ Sulama Zamanı - ${field.name}`,
                        `${dateStr} ${schedule.recommendedTime} arası ${schedule.waterAmount}L/m² su önerilmektedir.`,
                        schedule.date
                    );
                }

                // Create weather warning notification if heavy rain expected
                const heavyRainSchedule = schedules.find(s => s.note && s.note.includes('Yoğun yağmur'));
                if (heavyRainSchedule) {
                    const scheduleDate = new Date(heavyRainSchedule.date);
                    const dateStr = scheduleDate.toLocaleDateString('tr-TR', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric'
                    });

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
        console.error('Create AI irrigation schedule error:', error);
        // Fallback to basic schedule
        return await createIrrigationSchedule(fieldId, cropType, soilType, lat, lon);
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
            // Tahıllar
            'buğday': 4,
            'arpa': 3.5,
            'çavdar': 3.5,
            'mercimek': 3,
            'nohut': 2.5,

            // Sebzeler
            'domates': 6,
            'biber': 5.5,
            'patlıcan': 6.5,
            'salatalık': 6,
            'kabak': 5.5,
            'patates': 5,
            'soğan': 4,
            'sarımsak': 3,
            'havuç': 4,
            'lahana': 4.5,
            'marul': 4,
            'ispanak': 3,

            // Meyveler
            'elma': 3.5,
            'armut': 4,
            'çilek': 5,
            'kiraz': 3,
            'üzüm': 3,
            'şeftali': 4,
            'kayısı': 3.5,
            'erik': 4,
            'karpuz': 6,
            'kavun': 5.5,

            // Yağlı tohumlar
            'ayçiçeği': 4.5,
            'kanola': 3.5,
            'susam': 4,

            // Endüstriyel ürünler
            'pamuk': 7,
            'iplik bitkileri': 5,

            // Bahçe ve Diğer
            'mısır': 6,
            'zeytin': 2.5,
            'nar': 3,
            'incir': 2.5,
            'çay': 6.5,
            'kahve': 5.5,
            'çiçek': 3.5,
            'ot (saman)': 2.5
        };

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
            const soilKey = normalizeTrKey(soilType);
            if (soilKey === 'kumlu') waterAmount *= 1.2;
            else if (soilKey === 'killi') waterAmount *= 0.9;

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

        return schedules;
    } catch (error) {
        console.error('Create irrigation schedule error:', error);
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

const safeJsonParse = (value) => {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TarımZeka API running on port ${PORT}`);
    console.log(`📍 Location search: /api/location/search`);
    console.log(`📍 Reverse geocoding: /api/location/reverse`);
    console.log(`🌤️ Weather: /api/weather/current`);
    console.log(`🌾 Fields: /api/fields`);
    console.log(`💧 Irrigation: /api/irrigation/schedule`);
});